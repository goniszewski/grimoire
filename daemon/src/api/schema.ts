export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "ALL";

interface ApiSchemaBase {
  description?: string;
  nullable?: boolean;
  example?: unknown;
}

export interface ApiRefSchema extends ApiSchemaBase {
  ref: string;
}

export interface ApiStringSchema extends ApiSchemaBase {
  type: "string";
  enum?: readonly string[];
  format?: "date" | "date-time" | "uri" | "uuid";
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface ApiNumberSchema extends ApiSchemaBase {
  type: "number" | "integer";
  enum?: readonly number[];
  minimum?: number;
  maximum?: number;
}

export interface ApiBooleanSchema extends ApiSchemaBase {
  type: "boolean";
}

export interface ApiNullSchema extends ApiSchemaBase {
  type: "null";
}

export interface ApiArraySchema extends ApiSchemaBase {
  type: "array";
  items: ApiSchema;
}

export interface ApiObjectSchema extends ApiSchemaBase {
  type: "object";
  properties: Record<string, ApiSchema>;
  required?: readonly string[];
  additionalProperties?: boolean | ApiSchema;
}

export interface ApiOneOfSchema extends ApiSchemaBase {
  oneOf: readonly ApiSchema[];
}

export type ApiSchema =
  | ApiRefSchema
  | ApiStringSchema
  | ApiNumberSchema
  | ApiBooleanSchema
  | ApiNullSchema
  | ApiArraySchema
  | ApiObjectSchema
  | ApiOneOfSchema;

export type ApiSchemaMap = Record<string, ApiSchema>;

export interface ApiRequestBody {
  contentType: string;
  description?: string;
  schema: ApiSchema;
}

export interface ApiRequest {
  pathParams?: ApiObjectSchema;
  query?: ApiObjectSchema;
  body?: ApiRequestBody;
}

export interface ApiResponse {
  description: string;
  contentType?: string;
  schema?: ApiSchema;
  headers?: Record<string, string>;
}

export type ApiExampleBody =
  | string
  | number
  | boolean
  | null
  | readonly ApiExampleBody[]
  | { readonly [key: string]: ApiExampleBody };

export interface ApiExampleResponse {
  status: number;
  statusText?: string;
  contentType?: string;
  headers?: Record<string, string>;
  body?: ApiExampleBody;
}

export interface ApiExample {
  title: string;
  request: string;
  response?: ApiExampleResponse;
}

export interface ApiRoute {
  method: HttpMethod;
  path: string;
  tag: string;
  summary: string;
  description?: string;
  request?: ApiRequest;
  responses: Record<string, ApiResponse>;
  examples?: readonly ApiExample[];
}

export interface ApiContract {
  name: string;
  version: string;
  baseUrl: string;
  description: string;
  schemas: ApiSchemaMap;
  routes: readonly ApiRoute[];
}

type NullableValue<S, Value> = S extends { nullable: true } ? Value | null : Value;
type RequiredKeys<S> = S extends { required: readonly (infer K)[] } ? Extract<K, string> : never;
type ObjectProperties<S> = S extends { properties: infer P extends Record<string, ApiSchema> }
  ? P
  : Record<string, never>;

type InferAdditionalProperties<S> = S extends { additionalProperties: true }
  ? Record<string, unknown>
  : Record<never, never>;

type InferObject<S, Schemas extends ApiSchemaMap> = {
  [K in keyof ObjectProperties<S> as K extends RequiredKeys<S> ? K : never]: InferSchema<
    ObjectProperties<S>[K],
    Schemas
  >;
} & {
  [K in keyof ObjectProperties<S> as K extends RequiredKeys<S> ? never : K]?: InferSchema<
    ObjectProperties<S>[K],
    Schemas
  >;
} & InferAdditionalProperties<S>;

type InferOneOf<S, Schemas extends ApiSchemaMap> = S extends { oneOf: readonly (infer Item extends ApiSchema)[] }
  ? InferSchema<Item, Schemas>
  : never;

type InferNonNullableSchema<S, Schemas extends ApiSchemaMap> =
  S extends { ref: infer Ref extends keyof Schemas }
    ? InferSchema<Schemas[Ref], Schemas>
    : S extends { oneOf: readonly ApiSchema[] }
      ? InferOneOf<S, Schemas>
      : S extends { type: "string"; enum: readonly (infer E)[] }
        ? E
        : S extends { type: "integer" | "number"; enum: readonly (infer E)[] }
          ? E
          : S extends { type: "string" }
            ? string
            : S extends { type: "integer" | "number" }
              ? number
              : S extends { type: "boolean" }
                ? boolean
                : S extends { type: "null" }
                  ? null
                  : S extends { type: "array"; items: infer Item extends ApiSchema }
                    ? InferSchema<Item, Schemas>[]
                    : S extends { type: "object" }
                      ? InferObject<S, Schemas>
                      : unknown;

export type InferSchema<S, Schemas extends ApiSchemaMap> = NullableValue<
  S,
  InferNonNullableSchema<S, Schemas>
>;
