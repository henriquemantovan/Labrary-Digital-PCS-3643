/** Os adapters locais são síncronos; os adapters PostgreSQL aguardam o banco. */
export type AsyncRepository<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<R>
    : never;
};

export type DataRepository<T> = T | AsyncRepository<T>;
