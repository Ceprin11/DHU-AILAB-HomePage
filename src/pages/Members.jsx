import React, { useState, useEffect } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { Mail, X, GraduationCap, Compass, Award, FlaskConical, UserCog, MapPin, Heart, MessageCircle, ExternalLink } from 'lucide-react';
import { api } from '@/api/client';
import { Image } from '@/components/ui/image';
import SectionHeading from '@/components/SectionHeading';
import { ContentLoading, EmptyState } from '@/components/ContentState';
import { useSiteText } from '@/lib/siteText';
import { Reveal } from '@/components/motion/MotionPrimitives';
import { compareMembersByRoleAndName } from '@/lib/memberSort';

const DEST_LABEL = { '保研': '保研', '留学': '留学', '就业': '就业', '其他': '其他' };

const normalizeHomepageUrl = (value = '') => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
};

const normalizeGrade = (grade) => {
  const value = String(grade || '').trim().replace(/[级届]$/, '');
  if (!value) return null;
  if (/^\d{2}$/.test(value)) return { key: Number(`20${value}`), label: value };
  if (/^\d{4}$/.test(value)) return { key: Number(value), label: value.slice(-2) };
  return { key: value, label: value };
};

const formatGrade = (grade, text) => {
  const normalized = normalizeGrade(grade);
  return normalized ? `${normalized.label}${text('members_grade_suffix')}` : '';
};

const groupByGrade = (members, ascending = false) => {
  const groups = new Map();
  members.forEach((member) => {
    const normalized = normalizeGrade(member.grade);
    const key = normalized?.key ?? 'unassigned';
    if (!groups.has(key)) groups.set(key, { ...normalized, key, members: [] });
    groups.get(key).members.push(member);
  });
  return [...groups.values()].map((group) => ({
    ...group,
    members: group.members.sort(compareMembersByRoleAndName),
  })).sort((left, right) => {
    if (left.key === 'unassigned') return 1;
    if (right.key === 'unassigned') return -1;
    if (typeof left.key === 'number' && typeof right.key === 'number') {
      return ascending ? left.key - right.key : right.key - left.key;
    }
    return ascending
      ? String(left.key).localeCompare(String(right.key), 'zh-CN')
      : String(right.key).localeCompare(String(left.key), 'zh-CN');
  });
};

const getDestinationDetails = (member, text) => {
  const category = DEST_LABEL[member.destination] || member.destination;
  const legacy = String(member.destination_detail || '').split(/\s*[·，|]\s*/, 2);
  const organization = member.destination_organization || legacy[0] || '';
  const isEmployment = member.destination === '就业';

  return {
    category,
    organization,
    detailLabel: isEmployment ? text('members_position') : ['保研', '留学'].includes(member.destination) ? text('members_specialty') : '',
    detail: isEmployment
      ? member.destination_position || legacy[1] || ''
      : member.destination_specialty || legacy[1] || '',
  };
};

function DestinationDetails({ member, text, compact = false }) {
  const details = getDestinationDetails(member, text);
  const rows = [
    [text('members_destination_type'), details.category],
    [text('members_organization'), details.organization],
    [details.detailLabel, details.detail],
  ].filter(([label, value]) => label && value);

  return (
    <div className={compact ? 'mt-3 border-l-2 border-primary/25 pl-3' : 'mt-6 border-t border-border/80 pt-5'}>
      {!compact && <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Compass size={14} strokeWidth={1.8} className="text-primary" /> {text('members_destination')}</p>}
      <dl className={`${compact ? 'grid-cols-[3.5rem_minmax(0,1fr)] text-xs' : 'mt-3 grid-cols-[4.5rem_minmax(0,1fr)] text-sm'} grid gap-x-3 gap-y-1.5 leading-5`}>
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="whitespace-nowrap text-muted-foreground">{label}</dt>
            <dd className={compact ? 'min-w-0 break-words text-primary' : 'min-w-0 break-words text-foreground/90'}>{value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}

function PortraitMedia({ src, alt, imageWidth = 960, imageSizes = '100vw', loadPriority = 'auto' }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-secondary/70">
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        fittingType="fill"
        imageWidth={320}
        responsive={false}
        loadPriority="low"
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-2xl"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/5 to-background/25" />
      <Image
        src={src}
        alt={alt}
        fittingType="fit"
        imageWidth={imageWidth}
        imageSizes={imageSizes}
        loadPriority={loadPriority}
        className="relative h-full w-full object-contain"
      />
    </div>
  );
}

function MemberCard({ member, onClick, text, index = 0 }) {
  const reduceMotion = useReducedMotion();
  return (
    <m.button
      onClick={() => onClick(member)}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: reduceMotion ? 0 : 0.46, delay: reduceMotion ? 0 : Math.min(index, 6) * 0.055, ease: [0.16, 1, 0.3, 1] }}
      className="group min-w-0 rounded-xl text-left focus-visible:outline-offset-4"
      aria-label={`查看${member.name || '成员'}详情`}
    >
      <div className="aspect-[3/4] overflow-hidden rounded-xl border border-border/75 bg-secondary/60 shadow-[0_12px_30px_hsl(var(--foreground)/0.035)] transition-[border-color,box-shadow,transform] duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-[0_18px_36px_hsl(var(--primary)/0.09)] group-active:translate-y-px">
        {member.photo_url ? (
          <PortraitMedia
            src={member.photo_url}
            alt={`${member.name || '成员'}照片`}
            imageSizes="(min-width: 1280px) 260px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-accent/50 font-display text-5xl font-bold text-primary/25">{member.name?.[0] || '?'}</div>
        )}
      </div>
      <div className="pt-4">
        <div className="flex items-start justify-between gap-3 border-t border-border/75 pt-3">
          <h3 className="font-display text-lg font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">{member.name}</h3>
          {member.title && <span className="max-w-[8rem] shrink-0 text-right text-xs leading-5 text-primary">{member.title}</span>}
        </div>
        {(member.grade || member.graduated) && (
          <p className="mt-1.5 font-mono-date text-[11px] text-muted-foreground">
            {[formatGrade(member.grade, text), member.graduated && text('members_graduated_badge')].filter(Boolean).join(' / ')}
          </p>
        )}
        {member.graduated && member.destination && (
          <DestinationDetails member={member} text={text} compact />
        )}
      </div>
    </m.button>
  );
}

function FocusPanel({ member, onClose, text }) {
  const reduceMotion = useReducedMotion();
  const homepageUrl = normalizeHomepageUrl(member?.personal_homepage);
  useEffect(() => {
    if (!member) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [member, onClose]);

  return (
    <AnimatePresence>
    {member && (
    <m.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
      className="fixed inset-0 z-50 flex justify-end bg-foreground/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <m.div
        initial={reduceMotion ? false : { x: '100%' }}
        animate={{ x: 0 }}
        exit={reduceMotion ? undefined : { x: '100%' }}
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 330, damping: 36, mass: 0.85 }}
        className="h-full w-full max-w-lg overflow-y-auto border-l border-border/75 bg-background shadow-[0_0_60px_hsl(var(--foreground)/0.12)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-detail-title"
      >
        <div className="relative aspect-[5/4] overflow-hidden bg-secondary/60">
          {member.photo_url ? (
            <PortraitMedia
              src={member.photo_url}
              alt={`${member.name || '成员'}照片`}
              imageWidth={1440}
              imageSizes="(min-width: 512px) 512px, 100vw"
              loadPriority="high"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-display text-7xl font-bold text-primary/20">{member.name?.[0] || '?'}</div>
          )}
          <button onClick={onClose} aria-label="关闭成员详情" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-border/75 bg-background/90 text-foreground shadow-sm transition-[background-color,transform] duration-200 hover:bg-accent active:translate-y-px"><X size={17} /></button>
        </div>
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono-date text-xs text-muted-foreground">
            {member.grade && <span>{formatGrade(member.grade, text)}</span>}
            {member.graduated && <span>{text('members_graduated_badge')}</span>}
          </div>
          <h2 id="member-detail-title" className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground">{member.name}</h2>
          {member.title && <p className="mt-1 text-primary">{member.title}</p>}
          {member.graduated && member.destination && (
            <DestinationDetails member={member} text={text} />
          )}
          {(member.hometown || member.hobbies) && (
            <div className="mt-7 grid gap-5 border-y border-border/80 py-5 sm:grid-cols-2">
              {member.hometown && (
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><MapPin size={14} strokeWidth={1.8} className="text-primary" /> {text('members_from')}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{member.hometown}</p>
                </div>
              )}
              {member.hobbies && (
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Heart size={14} strokeWidth={1.8} className="text-primary" /> {text('members_hobbies')}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{member.hobbies}</p>
                </div>
              )}
            </div>
          )}
          {member.research_interests && (
            <div className={`${member.hometown || member.hobbies ? 'mt-5' : 'mt-7'} border-t border-border/80 pt-5`}>
              <p className="text-sm font-semibold text-foreground">{text('members_research')}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{member.research_interests}</p>
            </div>
          )}
          {member.bio && (
            <div className="mt-5 border-t border-border/80 pt-5">
              <p className="text-sm font-semibold text-foreground">{text('members_bio')}</p>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{member.bio}</p>
            </div>
          )}
          {member.competition_awards && (
            <div className="mt-5 border-t border-border/80 pt-5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Award size={14} strokeWidth={1.8} className="text-primary" /> {text('members_competition')}</p>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{member.competition_awards}</p>
            </div>
          )}
          {member.research_achievements && (
            <div className="mt-5 border-t border-border/80 pt-5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><FlaskConical size={14} strokeWidth={1.8} className="text-primary" /> {text('members_achievements')}</p>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{member.research_achievements}</p>
            </div>
          )}
          {member.graduated && member.message_to_juniors && (
            <div className="mt-5 border-t border-border/80 pt-5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><MessageCircle size={14} strokeWidth={1.8} className="text-primary" /> {text('members_message')}</p>
              <blockquote className="mt-2 border-l-2 border-primary/30 pl-4 text-sm leading-relaxed text-foreground/90">{member.message_to_juniors}</blockquote>
            </div>
          )}
          {(member.email || homepageUrl) && (
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              {member.email && <a href={`mailto:${member.email}`} className="inline-flex items-center gap-2 rounded-sm text-sm text-primary hover:underline"><Mail size={15} /> {member.email}</a>}
              {homepageUrl && <a href={homepageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-sm text-sm text-primary hover:underline"><ExternalLink size={15} /> {text('members_homepage')}</a>}
            </div>
          )}
        </div>
      </m.div>
    </m.div>
    )}
    </AnimatePresence>
  );
}

function MemberGradeGroups({ members, onClick, text, ascending = false }) {
  return (
    <div className="mt-8 space-y-12">
      {groupByGrade(members, ascending).map((group) => (
        <section key={group.key} aria-labelledby={`member-grade-${group.key}`}>
          <div className="flex items-center justify-between gap-4 border-b border-border/65 pb-3">
            <h4 id={`member-grade-${group.key}`} className="font-display text-lg font-semibold tracking-tight text-foreground">
              {group.label ? `${group.label}${text('members_grade_suffix')}` : text('members_grade_unassigned')}
            </h4>
            <span className="font-mono-date text-[11px] text-muted-foreground">
              {String(group.members.length).padStart(2, '0')} {text('members_count_unit')}
            </span>
          </div>
          <div className="mt-6 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group.members.map((member, index) => (
              <MemberCard key={member.id} member={member} onClick={onClick} text={text} index={index} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function Members() {
  const text = useSiteText();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [focus, setFocus] = useState(null);

  useEffect(() => {
    api.entities.Member.list('', 300)
      .then((r) => { setMembers(r || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const advisor = members.find((member) => member.category === 'advisor');
  const inSchool = members.filter((member) => member.category !== 'advisor' && !member.graduated);
  const graduated = members.filter((member) => member.category !== 'advisor' && member.graduated);

  return (
    <div className="page-shell page-section">
      <SectionHeading eyebrow={text('members_eyebrow')} title={text('members_title')} description={text('members_description')} />

      {loading ? (
        <ContentLoading variant="grid" count={4} className="lg:grid-cols-4" />
      ) : (
        <>
          {/* Advisor */}
          {advisor && (
            <Reveal as="section" className="mt-14 overflow-hidden border-y border-border/75 bg-secondary/30">
              <div className="grid md:grid-cols-[17rem_1fr]">
                <div className="aspect-[4/5] overflow-hidden bg-accent/40 md:aspect-auto md:min-h-[21rem]">
                  {advisor.photo_url ? (
                    <PortraitMedia
                      src={advisor.photo_url}
                      alt={`${advisor.name || '指导老师'}照片`}
                      imageSizes="(min-width: 768px) 272px, 100vw"
                      loadPriority="high"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center font-display text-7xl font-bold text-primary/25">{advisor.name?.[0] || '?'}</div>
                  )}
                </div>
                <div className="p-6 sm:p-8 md:p-10">
                  <div className="flex items-center gap-2 text-primary">
                    <UserCog size={17} strokeWidth={1.8} />
                    <p className="text-sm font-semibold">{text('members_advisor')}</p>
                  </div>
                  <h3 className="mt-5 font-display text-3xl font-bold tracking-tight text-foreground">{advisor.name}</h3>
                  {advisor.title && <p className="mt-1 text-primary">{advisor.title}</p>}
                  {advisor.research_interests && (
                    <div className="mt-6 border-t border-border/80 pt-5">
                      <p className="text-sm font-semibold text-foreground">{text('members_research')}</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{advisor.research_interests}</p>
                    </div>
                  )}
                  {advisor.bio && (
                    <div className="mt-5 border-t border-border/80 pt-5">
                      <p className="text-sm font-semibold text-foreground">{text('members_advisor_bio')}</p>
                      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{advisor.bio}</p>
                    </div>
                  )}
                  {advisor.email && (
                    <a href={`mailto:${advisor.email}`} className="mt-4 flex items-center gap-2 text-sm text-primary hover:underline"><Mail size={15} /> {advisor.email}</a>
                  )}
                </div>
              </div>
            </Reveal>
          )}

          {/* In-school members */}
          <section className="mt-16">
            <div className="flex items-end justify-between gap-4 border-b border-border/75 pb-4">
              <div className="flex items-center gap-2">
                <GraduationCap size={18} strokeWidth={1.8} className="text-primary" />
                <h3 className="font-display text-2xl font-semibold tracking-tight text-foreground">{text('members_current')}</h3>
              </div>
              <span className="font-mono-date text-xs text-muted-foreground">{String(inSchool.length).padStart(2, '0')} {text('members_count_unit')}</span>
            </div>
            {inSchool.length === 0 ? (
              <EmptyState title={text('members_empty_current')} icon={GraduationCap} compact className="mt-5" />
            ) : (
              <MemberGradeGroups members={inSchool} onClick={setFocus} text={text} ascending />
            )}
          </section>

          {/* Graduated members */}
          {graduated.length > 0 && (
            <section className="mt-16">
              <div className="flex items-end justify-between gap-4 border-b border-border/75 pb-4">
                <div className="flex items-center gap-2">
                  <Compass size={18} strokeWidth={1.8} className="text-primary" />
                  <h3 className="font-display text-2xl font-semibold tracking-tight text-foreground">{text('members_graduated')}</h3>
                </div>
                <span className="font-mono-date text-xs text-muted-foreground">{String(graduated.length).padStart(2, '0')} {text('members_count_unit')}</span>
              </div>
              <MemberGradeGroups members={graduated} onClick={setFocus} text={text} />
            </section>
          )}
        </>
      )}

      <FocusPanel member={focus} onClose={() => setFocus(null)} text={text} />
    </div>
  );
}
