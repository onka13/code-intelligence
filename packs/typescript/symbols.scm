; Declarations the TypeScript and JavaScript pack reads. Each capture is one declaration; the pack's describe module
; reads its name, signature and modifiers, and the core nests members into their containers by source range.

(program
  [(class_declaration) (abstract_class_declaration) (interface_declaration) (enum_declaration)
   (type_alias_declaration) (function_declaration) (generator_function_declaration)] @symbol)

(program
  (export_statement
    declaration: [(class_declaration) (abstract_class_declaration) (interface_declaration) (enum_declaration)
                  (type_alias_declaration) (function_declaration) (generator_function_declaration)] @symbol))

(program (lexical_declaration (variable_declarator) @symbol))
(program (variable_declaration (variable_declarator) @symbol))
(program (export_statement declaration: (lexical_declaration (variable_declarator) @symbol)))

(class_body [(method_definition) (public_field_definition) (abstract_method_signature)] @symbol)
(interface_body [(property_signature) (method_signature)] @symbol)
(enum_body [(property_identifier) (enum_assignment)] @symbol)
