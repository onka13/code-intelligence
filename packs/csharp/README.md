# C# pack

Files: `.cs`. Grammar: `tree-sitter-c-sharp` 0.23.5 (C# 12 and later).

**Declarations.** Classes, structs, records (positional parameters as properties), interfaces, enums and delegates, with nested types, methods, constructors, operators, indexers, properties (with their accessors) and fields. `public` and `internal` count as public. Base types named `I` + capital are interfaces.

**Imports.** A `using` resolves to every project file that declares the namespace; for `using static` and aliases, also the namespace the type sits in. Any other namespace is a package.

The sample project and its expected outputs are in [fixtures/](fixtures/). Solution and project references are read by the [msbuild pack](../msbuild/README.md).
