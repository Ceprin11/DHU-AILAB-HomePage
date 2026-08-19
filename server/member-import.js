const ACCOUNT_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

const clean = (value = '') => String(value).replace(/^\uFEFF/, '').trim();
const nameKey = (value = '') => clean(value).replace(/\s+/g, '').toLocaleLowerCase('zh-CN');
const accountKey = (value = '') => clean(value).toLowerCase();

export function normalizeMemberImportRows(input) {
  if (!Array.isArray(input)) {
    const error = new Error('导入内容格式错误');
    error.status = 400;
    throw error;
  }
  if (input.length === 0) {
    const error = new Error('请至少提供一位成员');
    error.status = 400;
    throw error;
  }
  if (input.length > 500) {
    const error = new Error('单次最多导入 500 位成员');
    error.status = 400;
    throw error;
  }

  return input.map((row, index) => {
    const account = clean(row?.account);
    const name = clean(row?.name);
    const grade = clean(row?.grade) || (/^\d{2}/.test(account) ? account.slice(0, 2) : '');
    const errors = [];
    if (!name) errors.push('姓名不能为空');
    if (name.length > 100) errors.push('姓名过长');
    if (!ACCOUNT_PATTERN.test(account)) errors.push('学号或工号格式不正确');
    if (grade.length > 20) errors.push('年级过长');
    return { row: index + 1, account, name, grade, errors };
  });
}

export function planMemberImport(rows, members, accounts) {
  const normalizedRows = normalizeMemberImportRows(rows);
  const memberById = new Map(members.map((member) => [member.id, member]));
  const accountByKey = new Map(accounts.map((account) => [accountKey(account.account), account]));
  const accountByMemberId = new Map(accounts.map((account) => [account.member_id, account]));
  const membersByName = new Map();
  for (const member of members) {
    const key = nameKey(member.name);
    if (!membersByName.has(key)) membersByName.set(key, []);
    membersByName.get(key).push(member);
  }

  const inputAccounts = new Map();
  const inputNames = new Map();
  for (const row of normalizedRows) {
    const aKey = accountKey(row.account);
    const nKey = nameKey(row.name);
    if (!inputAccounts.has(aKey)) inputAccounts.set(aKey, []);
    if (!inputNames.has(nKey)) inputNames.set(nKey, []);
    inputAccounts.get(aKey).push(row);
    inputNames.get(nKey).push(row);
  }

  const items = normalizedRows.map((row) => {
    const errors = [...row.errors];
    const aKey = accountKey(row.account);
    const nKey = nameKey(row.name);
    if (aKey && inputAccounts.get(aKey)?.length > 1) errors.push('导入文件中学号或工号重复');
    if (nKey && inputNames.get(nKey)?.length > 1) errors.push('导入文件中姓名重复，无法安全匹配');
    if (errors.length) return { ...row, action: 'conflict', message: errors.join('；') };

    const existingAccount = accountByKey.get(aKey);
    if (existingAccount) {
      const linkedMember = memberById.get(existingAccount.member_id);
      if (linkedMember && nameKey(linkedMember.name) === nKey) {
        return { ...row, action: 'skip', member_id: linkedMember.id, message: '账号已存在，无需重复导入' };
      }
      return { ...row, action: 'conflict', message: `该账号已绑定${linkedMember?.name ? `成员“${linkedMember.name}”` : '其他成员'}` };
    }

    const sameNameMembers = membersByName.get(nKey) || [];
    if (sameNameMembers.length > 1) {
      return { ...row, action: 'conflict', message: '网站内存在多位同名成员，请手动绑定账号' };
    }
    if (sameNameMembers.length === 1) {
      const member = sameNameMembers[0];
      const linkedAccount = accountByMemberId.get(member.id);
      if (linkedAccount) {
        return { ...row, action: 'conflict', member_id: member.id, message: `同名成员已有账号 ${linkedAccount.account}` };
      }
      return { ...row, action: 'bind', member_id: member.id, message: '绑定到已有成员，不覆盖已有资料' };
    }

    return { ...row, action: 'create', message: '创建未公开的草稿成员与登录账号' };
  });

  const counts = items.reduce((result, item) => {
    result[item.action] += 1;
    return result;
  }, { create: 0, bind: 0, skip: 0, conflict: 0 });

  return { counts, items };
}

export async function executeMemberImport(plan, { store, memberAccountStore }) {
  const results = [];

  for (const item of plan.items) {
    if (item.action === 'skip' || item.action === 'conflict') {
      results.push(item);
      continue;
    }

    try {
      if (item.action === 'bind') {
        await memberAccountStore.configureForMember(item.member_id, {
          account: item.account,
          active: true,
        });
        const existing = await store.get('Member', item.member_id);
        if (existing && !String(existing.grade || '').trim() && item.grade) {
          await store.update('Member', item.member_id, { grade: item.grade });
        }
        results.push({ ...item, status: 'success' });
        continue;
      }

      const member = await store.create('Member', {
        name: item.name,
        grade: item.grade,
        category: 'member',
        graduated: false,
        profile_status: 'draft',
      });
      try {
        await memberAccountStore.createForMember(member.id, item.account, { active: true });
        results.push({ ...item, member_id: member.id, status: 'success' });
      } catch (error) {
        await store.remove('Member', member.id).catch(() => {});
        throw error;
      }
    } catch (error) {
      results.push({ ...item, action: 'conflict', status: 'failed', message: error.message || '导入失败' });
    }
  }

  const counts = results.reduce((result, item) => {
    result[item.action] += 1;
    return result;
  }, { create: 0, bind: 0, skip: 0, conflict: 0 });
  return { counts, items: results };
}
