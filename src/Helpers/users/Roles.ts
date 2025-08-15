import { TechAdmin } from "../../entities/users/TechAdminUser";
import { Admin } from "../../entities/users/AdminUser";
import { MiniAdmin } from "../../entities/users/MiniAdminUser";
import { SuperMaster } from "../../entities/users/SuperMasterUser";
import { Master } from "../../entities/users/MasterUser";
import { SuperAgent } from "../../entities/users/SuperAgentUser";
import { Agent } from "../../entities/users/AgentUser";
import { Client } from "../../entities/users/ClientUser";


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

export const DOWNLINE_MAPPING = {
  developer: ["techAdmin"],  
  techAdmin: ["admin", "miniAdmin", "superMaster", "master", "superAgent", "agent", "client"],
  admin: ["miniAdmin", "superMaster", "master", "superAgent", "agent", "client"],
  miniAdmin: ["superMaster", "master", "superAgent", "agent", "client"],
  superMaster: ["master", "superAgent", "agent", "client"],
  master: ["superAgent", "agent", "client"],
  superAgent: ["agent", "client"],
  agent: ["client"],
  client: []
} as const;

export const USER_TABLES: Record<string, any> = {
  techAdmin: TechAdmin,
  admin: Admin,
  miniAdmin: MiniAdmin,
  superMaster: SuperMaster,
  master: Master,
  superAgent: SuperAgent,
  agent: Agent,
  client: Client
};
