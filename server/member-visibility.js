export const isPublicMember = (member) => Boolean(member?.photo_url)
  && member.profile_status !== 'draft'
  && member.profile_status !== 'hidden';
