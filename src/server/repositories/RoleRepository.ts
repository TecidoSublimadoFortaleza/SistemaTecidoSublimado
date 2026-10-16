import { Database } from '../db/database';
import { Role, Sector, Branch } from '../types';

export class RoleRepository {
  private db = Database.getInstance();

  public async getRoleById(roleId: string): Promise<Role | null> {
    if (!roleId) return null;
    let role = this.db.roles.get(roleId);
    if (role && role.deletedAt == null) return role;

    const clean = String(roleId).trim().toLowerCase();

    // Direct search by case-insensitive id or name
    for (const r of this.db.roles.values()) {
      if (r.deletedAt != null) continue;
      if (r.id.toLowerCase() === clean || r.name.toLowerCase() === clean) {
        return r;
      }
    }

    // Normalized ROLE- key search
    const normalizedId = `ROLE-${roleId.toUpperCase().replace(/[\(\)\s]+/g, '_')}`;
    role = this.db.roles.get(normalizedId);
    if (role && role.deletedAt == null) return role;

    // Look specifically for ADM MASTER / Master Admin
    if (clean.includes('master') || clean.includes('adm master') || clean.includes('admin master')) {
      const admRole = this.db.roles.get('ROLE-ADM_MASTER');
      if (admRole && admRole.deletedAt == null) return admRole;
      for (const r of this.db.roles.values()) {
        if (r.name.toUpperCase().includes('ADM') || r.name.toUpperCase().includes('MASTER')) {
          return r;
        }
      }
    }

    return null;
  }

  public async getSectorById(sectorId: string): Promise<Sector | null> {
    const sector = this.db.sectors.get(sectorId);
    if (!sector || sector.deletedAt != null) return null;
    return sector;
  }

  public async getBranchById(branchId: string): Promise<Branch | null> {
    const branch = this.db.branches.get(branchId);
    if (!branch || branch.deletedAt != null) return null;
    return branch;
  }

  public async listRoles(): Promise<Role[]> {
    return Array.from(this.db.roles.values()).filter((r) => r.deletedAt == null);
  }

  public async listSectors(): Promise<Sector[]> {
    return Array.from(this.db.sectors.values()).filter((s) => s.deletedAt == null);
  }

  public async listBranches(): Promise<Branch[]> {
    return Array.from(this.db.branches.values()).filter((b) => b.deletedAt == null);
  }
}
