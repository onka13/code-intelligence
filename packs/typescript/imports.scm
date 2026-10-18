; Module specifiers: static imports, re-exports, require() and dynamic import().

(import_statement source: (string (string_fragment) @source))
(export_statement source: (string (string_fragment) @source))
((call_expression
   function: (identifier) @_fn
   arguments: (arguments . (string (string_fragment) @source)))
 (#eq? @_fn "require"))
(call_expression function: (import) arguments: (arguments . (string (string_fragment) @source)))
