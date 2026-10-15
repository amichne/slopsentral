import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const commands = { kotlinc: process.env.KOTLINC || 'kotlinc', java: process.env.JAVA || 'java' };
const required = process.env.REQUIRE_KOTLIN_EXAMPLE_CHECKS === '1';
const unavailable = Object.entries(commands).flatMap(([name, command]) => {
  const result = spawnSync(command, ['-version'], { encoding: 'utf8', timeout: 15_000 });
  return !result.error && result.status === 0 ? [] : [
    `${name} preflight failed (${command}): ${result.error?.message || result.stderr || result.stdout || result.status}`,
  ];
});

function kotlinTest(name, check) {
  test(name, { skip: unavailable.length && !required ? unavailable.join('; ') : false }, () => {
    assert.equal(unavailable.length, 0, `Required Kotlin example checks lack a usable compiler/runtime:\n${unavailable.join('\n')}`);
    check();
  });
}

function run(command, args) {
  const result = spawnSync(commands[command], args, {
    cwd: root, encoding: 'utf8', timeout: 90_000, maxBuffer: 1024 * 1024,
  });
  assert.ifError(result.error); // Once preflight passes, failures remain explicit.
  return result;
}

function checked(command, args) {
  const result = run(command, args);
  assert.equal(result.status, 0, `${command} failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}

function exampleContract(source, legal, forbidden) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'principle-contract-'));
  try {
    const example = path.join(directory, 'Example.kt');
    const harness = path.join(directory, 'Harness.kt');
    const jar = path.join(directory, 'example.jar');
    fs.writeFileSync(example, source);
    fs.writeFileSync(harness, legal);
    checked('kotlinc', [example, harness, '-include-runtime', '-d', jar]);
    checked('java', ['-jar', jar]);
    for (const [snippet, diagnostic] of forbidden) {
      const misuse = path.join(directory, 'Forbidden.kt');
      fs.writeFileSync(misuse, snippet);
      const rejection = run('kotlinc', ['-classpath', jar, misuse, '-d', path.join(directory, 'forbidden.jar')]);
      assert.notEqual(rejection.status, 0, `Named illegal call must fail compilation: ${snippet}`);
      assert.match(rejection.stderr, diagnostic, 'Rejection must identify the intended structural restriction');
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

kotlinTest('OrderId parsing and typed creation preserve tenant and positive sequence facts', () => {
  exampleContract(read('source/concepts/type-safety/kotlin/value-construction.kt'), `
fun main() {
    fun classify(parsed: OrderIdParse): String = when (parsed) {
        is OrderIdParse.Parsed -> "PARSED"
        OrderIdParse.MalformedShape -> "SHAPE"
        is OrderIdParse.InvalidTenant -> "TENANT"
        is OrderIdParse.InvalidSequence -> "SEQUENCE"
    }
    check(classify(OrderId.parse("acme::1")) == "PARSED")
    val parsed = OrderId.parse("acme::01")
    check(parsed is OrderIdParse.Parsed)
    check(parsed.order.toString() == "acme::1")
    check(OrderId.create(parsed.order.tenant, parsed.order.sequence).toString() == "acme::1")
    for (raw in listOf("acme", "acme::1::2")) check(classify(OrderId.parse(raw)) == "SHAPE")
    for (raw in listOf("::1", " ::1")) check(classify(OrderId.parse(raw)) == "TENANT")
    for (raw in listOf("acme::0", "acme::-1", "acme::word", "acme::", "acme::9223372036854775808"))
        check(classify(OrderId.parse(raw)) == "SEQUENCE")
    check(TenantId.parse("a::b") == TenantIdParse.Rejected(TenantIdFailure.RESERVED_SEPARATOR))
    check(OrderSequence.parse("0") == OrderSequenceParse.Rejected(OrderSequenceFailure.NOT_POSITIVE))
}
`, [
    ['fun weakCall(): OrderId = OrderId.create("acme", 1L)', /argument type mismatch/],
    ['fun uncheckedTenant() = TenantId("")', /cannot access.*constructor/s],
    ['fun uncheckedSequence() = OrderSequence(0)', /cannot access.*constructor/s],
    ['fun uncheckedOrder(tenant: TenantId, sequence: OrderSequence) = OrderId(tenant, sequence)', /cannot access.*constructor/s],
    ['fun uncheckedCopy(order: OrderId) = order.copy()', /cannot access.*copy/s],
  ]);
});

const orderSource = () => read('source/concepts/type-safety/kotlin/value-construction.kt');

kotlinTest('OrderId retains value equality and hash-based lookup', () => {
  exampleContract(orderSource(), `
fun main() {
    val first = OrderId.parse("acme::01")
    val second = OrderId.parse("acme::1")
    check(first is OrderIdParse.Parsed && second is OrderIdParse.Parsed)
    check(first.order == second.order)
    check(first.order.hashCode() == second.order.hashCode())
    check(setOf(first.order, second.order).size == 1)
    check(mapOf(first.order to "found")[second.order] == "found")
}
`, []);
});

kotlinTest('OrderId construction survives serialization and parsing with colon tenants', () => {
  exampleContract(orderSource(), `
fun main() {
    val sequence = OrderSequence.parse("1")
    check(sequence is OrderSequenceParse.Parsed)
    for (rawTenant in listOf("acme", "acme:", ":acme", "ac:me", ":")) {
        val tenant = TenantId.parse(rawTenant)
        check(tenant is TenantIdParse.Parsed)
        val original = OrderId.create(tenant.tenant, sequence.sequence)
        val reparsed = OrderId.parse(original.toString())
        check(reparsed is OrderIdParse.Parsed)
        check(reparsed.order.tenant == original.tenant)
        check(reparsed.order.sequence == original.sequence)
        check(reparsed.order.toString() == original.toString())
    }
    check(OrderId.parse("acme::1::2") == OrderIdParse.MalformedShape)
}
`, []);
});

kotlinTest('configuration serialization preserves the closed recursive value universe', () => {
  exampleContract(read('source/concepts/type-safety/kotlin/config-value.kt'), `
fun main() {
    val value = ConfigValue.Sequence(listOf(ConfigValue.Count(2), ConfigValue.Flag(true), ConfigValue.Composite(mapOf("nested" to ConfigValue.Text("x")))))
    check(serialize(value) == JsonValue.Sequence(listOf(JsonValue.Count(2), JsonValue.Flag(true), JsonValue.Composite(mapOf("nested" to JsonValue.Text("x"))))))
}
`, [['fun arbitraryElement() = ConfigValue.Sequence(listOf(Any()))', /argument type mismatch/]]);
});
