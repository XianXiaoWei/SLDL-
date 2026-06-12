// Type declarations for sldl-objects.

export const kObjectExceptions: Record<string, {
  message?: string;
  builder?: (...args: any[]) => string;
  from(...args: any[]): Error;
}>;

export const kMemvarTypes: {
  Raw: 0;
  String: 1;
  Ref: 2;
  Array: 3;
};

export const kMetaTypes: Record<string, any>;

export const kMetaValueType: {
  None: 0;
  Number: 1;
  String: 2;
  Struct: 3;
  Class: 4;
  Pointer: 5;
  Raw: 6;
};

export class LevelObjects {
  static read(
    buffer: Buffer,
    declGroup?: Record<string, any>
  ): { objects: Record<string, any>; declGroup: Record<string, any> };

  static write(
    objects: Record<string, any>,
    declGroup: Record<string, any>
  ): Buffer;
}

export class DeclarationGroup {
  types: Map<string, any>;
  classes: Map<string, any>;
  enumConstants: Map<string, any>;
  enumInfo: Map<string, any>;
  constructor(declGroup: Record<string, any>);
  parse(): this;
  resolveType(name: string): any;
}
