plugins {
    kotlin("jvm") version "2.4.10"
    kotlin("plugin.serialization") version "2.4.10"
    application
}

repositories {
    mavenCentral()
    maven("https://repo.gradle.org/gradle/libs-releases")
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.11.0")
    implementation("org.gradle:gradle-tooling-api:9.7.1")

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
    applicationDefaultJvmArgs = listOf("--add-modules=jdk.jdi")
}

tasks.test {
    useJUnitPlatform()
}
