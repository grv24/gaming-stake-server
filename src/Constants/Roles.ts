export const ROLE_HIERARCHY = {
  developer: 9,  
  techAdmin: 8,
  admin: 7,
  miniAdmin: 6,
  superMaster: 5,
  master: 4,
  superAgent: 3,
  agent: 2,
  client: 1
} as const;

export type Role = keyof typeof ROLE_HIERARCHY;