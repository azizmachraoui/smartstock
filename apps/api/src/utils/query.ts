export const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const paging = (q: any) => { const page = Math.max(+q.page || 1, 1), limit = Math.min(Math.max(+q.limit || 20, 1), 100); return { page, limit, skip: (page - 1) * limit }; };
export const sortOf = (q: any, allowed: string[], fallback: string) => {
  const key = String(q.sort || fallback); if (!allowed.includes(key.replace(/^-/, ''))) throw new Error(`SORT:${allowed.join(', ')}`); return key;
};
