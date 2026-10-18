; Names a file exports without an `export` keyword on the declaration: export lists, export default <name>,
; and CommonJS (module.exports = { a, b }, module.exports.a = ..., exports.a = ...).

(export_statement (export_clause (export_specifier name: (identifier) @name)) !source)
(export_statement value: (identifier) @name)
((assignment_expression
   left: (member_expression object: (identifier) @_m property: (property_identifier) @_e)
   right: (object [(shorthand_property_identifier) @name (pair value: (identifier) @name)]))
 (#eq? @_m "module") (#eq? @_e "exports"))
((assignment_expression
   left: (member_expression
     object: (member_expression object: (identifier) @_m property: (property_identifier) @_e)
     property: (property_identifier) @name))
 (#eq? @_m "module") (#eq? @_e "exports"))
((assignment_expression left: (member_expression object: (identifier) @_e property: (property_identifier) @name))
 (#eq? @_e "exports"))
