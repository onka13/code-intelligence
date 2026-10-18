; Declarations the Dart pack reads. Dart keeps a function's body as the next sibling of its signature, and a top-level
; variable's modifiers and type as siblings of its name list; the pack's describe module reads both.

(program
  [(class_definition) (mixin_declaration) (extension_declaration) (enum_declaration) (type_alias)
   (function_signature) (getter_signature) (setter_signature)] @symbol)

(program (static_final_declaration_list (static_final_declaration) @symbol))
(program (initialized_identifier_list (initialized_identifier) @symbol))

(class_body [(declaration) (method_signature)] @symbol)
(extension_body [(declaration) (method_signature)] @symbol)
(enum_body [(enum_constant) (declaration) (method_signature)] @symbol)
