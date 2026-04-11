import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSpaceAccessContract } from '../../src/modules/spaces/access.ts';
import { resolveSpaceGovernanceRoleForRuntimeSpaceRole } from '../../src/modules/spaces/governance.ts';

test('space access contract keeps platform governance product-independent', () => {
  const access = resolveSpaceAccessContract({
    governance: resolveSpaceGovernanceRoleForRuntimeSpaceRole('admin'),
    profile: 'messenger_full',
    role: 'admin',
  });

  assert.equal(access.platform.membership.role, 'admin');
  assert.equal(access.platform.membership.canAccessSpace, true);
  assert.equal(access.platform.governance.governanceRole, 'space_admin');
  assert.equal(access.platform.governance.canManageMembers, true);

  assert.equal(access.products.messenger.isPrimaryProfile, true);
  assert.equal(access.products.messenger.canAccessInbox, true);
  assert.equal(access.products.keepcozy.isPrimaryProfile, false);
  assert.equal(access.products.keepcozy.canAccessOperationalShell, true);
});

test('space access contract preserves ordinary member limits across products', () => {
  const access = resolveSpaceAccessContract({
    governance: resolveSpaceGovernanceRoleForRuntimeSpaceRole('member'),
    profile: 'keepcozy_ops',
    role: 'member',
  });

  assert.equal(access.platform.membership.role, 'member');
  assert.equal(access.platform.governance.governanceRole, 'space_member');
  assert.equal(access.platform.governance.canManageMembers, false);

  assert.equal(access.products.keepcozy.isPrimaryProfile, true);
  assert.equal(access.products.keepcozy.canManageMembers, false);
  assert.equal(access.products.messenger.isPrimaryProfile, false);
  assert.equal(access.products.messenger.canAccessChat, true);
});
