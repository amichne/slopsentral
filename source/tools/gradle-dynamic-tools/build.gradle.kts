plugins {
    kotlin("jvm") version "2.4.10"
    kotlin("plugin.serialization") version "2.4.10"
    application
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.11.0")

    testImplementation(kotlin("test"))
}

kotlin {
    jvmToolchain(21)
    compilerOptions {
        allWarningsAsErrors = true
    }
}

sourceSets {
    main {
        resources.srcDir("../../schemas/gradle-dynamic-tools")
    }
}

application {
    mainClass = "io.github.amichne.slopsentral.gradle.MainKt"
}

tasks.test {
    useJUnitPlatform()
}
