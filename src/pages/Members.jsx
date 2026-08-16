import React, { useState, useEffect } from 'react';
import { Mail, X, GraduationCap, Compass, Award, FlaskConical, UserCog, MapPin, Heart, MessageCircle } from 'lucide-react';
import { api } from '@/api/client';
import { Image } from '@/components/ui/image';
import SectionHeading from '@/components/SectionHeading';
import { ContentLoading, EmptyState } from '@/components/ContentState';
import { useSiteText } from '@/lib/siteText';

const DEST_LABEL = { '保研': '保研', '留学': '留学', '就业': '就业', '其他': '其他' };

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

function PortraitMedia({ src, alt }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-secondary/70">
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        fittingType="fill"
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-2xl"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/5 to-background/25" />
      <Image
        src={src}
        alt={alt}
        fittingType="fit"
        className="relative h-full w-full object-contain"
      />
    </div>
  );
}

function MemberCard({ m, onClick, text }) {
  return (
    <button
      onClick={() => onClick(m)}
      className="group min-w-0 rounded-xl text-left focus-visible:outline-offset-4"
      aria-label={`查看${m.name || '成员'}详情`}
    >
      <div className="aspect-[3/4] overflow-hidden rounded-xl border border-border/75 bg-secondary/60 shadow-[0_12px_30px_hsl(var(--foreground)/0.035)] transition-[border-color,box-shadow,transform] duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-[0_18px_36px_hsl(var(--primary)/0.09)] group-active:translate-y-px">
        {m.photo_url ? (
          <PortraitMedia src={m.photo_url} alt={`${m.name || '成员'}照片`} />
        ) : (
          <div className="flex h-full items-center justify-center bg-accent/50 font-display text-5xl font-bold text-primary/25">{m.name?.[0] || '?'}</div>
        )}
      </div>
      <div className="pt-4">
        <div className="flex items-start justify-between gap-3 border-t border-border/75 pt-3">
          <h3 className="font-display text-lg font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">{m.name}</h3>
          {m.title && <span className="max-w-[8rem] shrink-0 text-right text-xs leading-5 text-primary">{m.title}</span>}
        </div>
        {(m.grade || m.graduated) && (
          <p className="mt-1.5 font-mono-date text-[11px] text-muted-foreground">
            {[m.grade && `${m.grade}${text('members_grade_suffix')}`, m.graduated && text('members_graduated_badge')].filter(Boolean).join(' / ')}
          </p>
        )}
        {m.graduated && m.destination && (
          <DestinationDetails member={m} text={text} compact />
        )}
      </div>
    </button>
  );
}

function FocusPanel({ member, onClose, text }) {
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

  if (!member) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/30 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg overflow-y-auto border-l border-border/75 bg-background shadow-[0_0_60px_hsl(var(--foreground)/0.12)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-detail-title"
      >
        <div className="relative aspect-[5/4] overflow-hidden bg-secondary/60">
          {member.photo_url ? (
            <PortraitMedia src={member.photo_url} alt={`${member.name || '成员'}照片`} />
          ) : (
            <div className="flex h-full items-center justify-center font-display text-7xl font-bold text-primary/20">{member.name?.[0] || '?'}</div>
          )}
          <button onClick={onClose} aria-label="关闭成员详情" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-border/75 bg-background/90 text-foreground shadow-sm transition-[background-color,transform] duration-200 hover:bg-accent active:translate-y-px"><X size={17} /></button>
        </div>
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono-date text-xs text-muted-foreground">
            {member.grade && <span>{member.grade}{text('members_grade_suffix')}</span>}
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
          {member.email && (
            <a href={`mailto:${member.email}`} className="mt-6 inline-flex items-center gap-2 rounded-sm text-sm text-primary hover:underline"><Mail size={15} /> {member.email}</a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Members() {
  const text = useSiteText();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [focus, setFocus] = useState(null);

  useEffect(() => {
    api.entities.Member.list('order_index', 300)
      .then((r) => { setMembers(r || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const sorted = [...members].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  const advisor = sorted.find((m) => m.category === 'advisor');
  const inSchool = sorted.filter((m) => m.category !== 'advisor' && !m.graduated);
  const graduated = sorted.filter((m) => m.category !== 'advisor' && m.graduated);

  return (
    <div className="page-shell page-section">
      <SectionHeading eyebrow={text('members_eyebrow')} title={text('members_title')} description={text('members_description')} />

      {loading ? (
        <ContentLoading variant="grid" count={4} className="lg:grid-cols-4" />
      ) : (
        <>
          {/* Advisor */}
          {advisor && (
            <section className="mt-14 overflow-hidden border-y border-border/75 bg-secondary/30">
              <div className="grid md:grid-cols-[17rem_1fr]">
                <div className="aspect-[4/5] overflow-hidden bg-accent/40 md:aspect-auto md:min-h-[21rem]">
                  {advisor.photo_url ? (
                    <PortraitMedia src={advisor.photo_url} alt={`${advisor.name || '指导老师'}照片`} />
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
            </section>
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
              <div className="mt-7 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {inSchool.map((m) => <MemberCard key={m.id} m={m} onClick={setFocus} text={text} />)}
              </div>
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
              <div className="mt-7 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {graduated.map((m) => <MemberCard key={m.id} m={m} onClick={setFocus} text={text} />)}
              </div>
            </section>
          )}
        </>
      )}

      <FocusPanel member={focus} onClose={() => setFocus(null)} text={text} />
    </div>
  );
}
