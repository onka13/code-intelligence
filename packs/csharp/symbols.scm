; Declarations the C# pack reads. A file-scoped namespace is a sibling of its types, a block namespace holds them in
; its declaration_list; neither is captured, so types are top level. Types nested in a type become its members.

(compilation_unit
  [(class_declaration) (struct_declaration) (record_declaration) (interface_declaration) (enum_declaration)
   (delegate_declaration)] @symbol)

(declaration_list
  [(class_declaration) (struct_declaration) (record_declaration) (interface_declaration) (enum_declaration)
   (delegate_declaration)
   (method_declaration) (constructor_declaration) (destructor_declaration) (operator_declaration)
   (conversion_operator_declaration) (indexer_declaration) (property_declaration) (field_declaration)
   (event_field_declaration) (event_declaration)] @symbol)

(enum_member_declaration_list (enum_member_declaration) @symbol)

(record_declaration (parameter_list (parameter) @symbol))
