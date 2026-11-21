// Who may grant or change administrator rights for member accounts.
//
// The "super administrator" is the account configured in the environment (ADMIN_ACCOUNT). Members can be made
// administrators too, but only the super administrator decides who they are and can change their accounts.

// A member administrator only has admin rights once the initial password (which equals the student id) was replaced.
export const isEffectiveAdmin = (account) => (
  account?.is_admin === true && account.active !== false && account.must_change_password === false
);

const accountKey = (value) => String(value ?? '').trim().toLowerCase();

export const checkMemberAccountChange = ({ auth, target, config }) => {
  if (auth?.super === true) return '';
  const grantsOrRevokes = typeof config.admin === 'boolean' && config.admin !== (target?.is_admin === true);
  if (grantsOrRevokes) return '只有超级管理员可以授予或收回管理员权限';
  if (target?.is_admin === true) {
    const changesAccount = Boolean(String(config.account ?? '').trim()) && accountKey(config.account) !== accountKey(target.account);
    const changesActive = typeof config.active === 'boolean' && config.active !== (target.active !== false);
    if (changesAccount || changesActive || config.resetPassword === true) return '管理员成员的登录账号只能由超级管理员修改';
  }
  return '';
};

export const checkMemberDeletion = ({ auth, target }) => (
  target?.is_admin === true && auth?.super !== true ? '管理员成员只能由超级管理员删除' : ''
);
