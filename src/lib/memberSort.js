const MEMBER_ROLE_RANK = {
  president: 0,
  vice_president: 1,
  core: 2,
  member: 3,
};

const nameCollator = new Intl.Collator('zh-CN-u-co-pinyin', {
  sensitivity: 'base',
  numeric: true,
});

export function getMemberRoleRank(member) {
  const title = String(member?.title || '').trim();
  if (title.includes('副社长')) return MEMBER_ROLE_RANK.vice_president;
  if (title.includes('社长')) return MEMBER_ROLE_RANK.president;
  return MEMBER_ROLE_RANK[member?.category] ?? MEMBER_ROLE_RANK.member;
}

export function compareMembersByRoleAndName(left, right) {
  const rankDifference = getMemberRoleRank(left) - getMemberRoleRank(right);
  if (rankDifference) return rankDifference;
  const nameDifference = nameCollator.compare(String(left?.name || ''), String(right?.name || ''));
  if (nameDifference) return nameDifference;
  return String(left?.id || '').localeCompare(String(right?.id || ''));
}
