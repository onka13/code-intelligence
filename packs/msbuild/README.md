# MSBuild pack

Files: `.csproj .props .targets .sln .slnx`.

**Dependencies.** `PackageReference` entries are dependencies. `PrivateAssets="all"` marks a development dependency. The version is empty with central package management.

**Imports.** `ProjectReference` entries and the projects of a solution are imports, so project references are edges of the dependency graph.

**Parsing.** A small strict XML reader. A malformed file is recorded with its error and the scan goes on.

The sample project and its expected outputs are in [fixtures/](fixtures/).
