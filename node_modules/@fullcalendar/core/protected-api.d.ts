interface BaseOptions {
}
interface BaseOptionsRefined {
}
interface EventSourceOptions {
}
interface EventSourceOptionsRefined {
}
interface EventRefiners {
}
type RawOptionsFromRefiners<Refiners extends GenericRefiners> = {
    [Prop in keyof Refiners]?: Refiners[Prop] extends ((input: infer RawType, optionName: string) => infer RefinedType) ? (any extends RawType ? RefinedType : RawType) : never;
};
type RefinedOptionsFromRefiners<Refiners extends GenericRefiners> = {
    [Prop in keyof Refiners]?: Refiners[Prop] extends ((input: any, optionName: string) => infer RefinedType) ? RefinedType : never;
};
type GenericRefiners = {
    [propName: string]: (input: any, propName: string) => any;
};
type Identity<T = any> = (raw: T) => T;
declare class JsonRequestError extends Error {
    response: Response;
    constructor(message: string, response: Response);
}
declare function requestJson<ParsedResponse>(method: string, url: string, params: Record<string, any>): Promise<[ParsedResponse, Response]>;
declare function identity<T>(raw: T): T;

export { BaseOptions, BaseOptionsRefined, EventRefiners, EventSourceOptions, EventSourceOptionsRefined, Identity, JsonRequestError, RawOptionsFromRefiners, RefinedOptionsFromRefiners, identity, requestJson };
