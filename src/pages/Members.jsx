import React, { useState, useEffect } from 'react';
import { Mail, X, Loader2, GraduationCap, Compass, Award, FlaskConical, UserCog } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import SectionHeading from '@/components/SectionHeading';
import { cn } from '@/lib/utils';

const DEST_LABEL = { '保研': '保研', '留学': '留学', '就业': '就业', '其他': '其他' };

function MemberCard({ m, onClick }) {
  return (
    <button onClick={() => onClick(m)} className="group overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:border-primary/40 hover:shadow-md">
      <div className="relative aspect-[4/5] overflow-hidden bg-accent/40">
        {m.photo_url ? (
          <Image src={m.photo_url} fittingType="fill" className="h-full w-full grayscale transition-all duration-500 group-hover:grayscale-0" />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-4xl font-bold text-primary/30">{m.name?.[0] || '?'}</div>
        )}
        {m.graduated && (
          <span className="absolute right-3 top-3 rounded-full bg-foreground/70 px-2 py-0.5 text-[10px] font-semibold text-background backdrop-blur">已毕业</span>
        )}
        {m.grade && (
          <span className="absolute left-3 top-3 rounded-full bg-background/80 px-2 py-0.5 font-mono-date text-[10px] text-foreground backdrop-blur">{m.grade}级</span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-foreground">{m.name}</h3>
          {m.title && <span className="shrink-0 rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{m.title}</span>}
        </div>
        {m.research_interests && <p className="mt-1.5 line-clamp-1 text-sm text-muted-foreground">{m.research_interests}</p>}
        {m.graduated && m.destination && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-primary"><Compass size={12} /> 去向：{DEST_LABEL[m.destination] || m.destination}</p>
        )}
      </div>
    </button>
  );
}

function FocusPanel({ member, onClose }) {
  if (!member) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/40" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-background shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="relative aspect-[4/3] bg-accent/40">
          {member.photo_url && <Image src={member.photo_url} fittingType="fill" className="h-full w-full" />}
          <button onClick={onClose} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow"><X size={16} /></button>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-2">
            {member.grade && <span className="font-mono-date text-xs text-muted-foreground">{member.grade}级</span>}
            {member.graduated && <span className="rounded bg-foreground/70 px-2 py-0.5 text-[10px] font-semibold text-background">已毕业</span>}
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold text-foreground">{member.name}</h2>
          {member.title && <p className="mt-1 text-primary">{member.title}</p>}
          {member.graduated && member.destination && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-primary"><Compass size={14} /> 去向：{DEST_LABEL[member.destination] || member.destination}</p>
          )}
          {member.research_interests && (
            <div className="mt-5">
              <p className="font-mono-date text-xs uppercase tracking-widest text-muted-foreground">研究方向</p>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{member.research_interests}</p>
            </div>
          )}
          {member.bio && (
            <div className="mt-5">
              <p className="font-mono-date text-xs uppercase tracking-widest text-muted-foreground">个人简介</p>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{member.bio}</p>
            </div>
          )}
          {member.competition_awards && (
            <div className="mt-5">
              <p className="flex items-center gap-1.5 font-mono-date text-xs uppercase tracking-widest text-muted-foreground"><Award size={12} /> 竞赛获奖</p>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{member.competition_awards}</p>
            </div>
          )}
          {member.research_achievements && (
            <div className="mt-5">
              <p className="flex items-center gap-1.5 font-mono-date text-xs uppercase tracking-widest text-muted-foreground"><FlaskConical size={12} /> 科研成果</p>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{member.research_achievements}</p>
            </div>
          )}
          {member.email && (
            <a href={`mailto:${member.email}`} className="mt-6 flex items-center gap-2 text-sm text-primary hover:underline"><Mail size={15} /> {member.email}</a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Members() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [focus, setFocus] = useState(null);

  useEffect(() => {
    base44.entities.Member.list('order_index', 300)
      .then((r) => { setMembers(r || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const sorted = [...members].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  const advisor = sorted.find((m) => m.category === 'advisor');
  const inSchool = sorted.filter((m) => m.category !== 'advisor' && !m.graduated);
  const graduated = sorted.filter((m) => m.category !== 'advisor' && m.graduated);

  return (
    <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
      <SectionHeading eyebrow="Our Team" title="团队" description="汇聚东华大学对人工智能充满热忱的青年学者与指导老师。" />

      {loading ? (
        <div className="flex justify-center py-20 text-muted-foreground"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          {/* Advisor */}
          {advisor && (
            <div className="mt-12">
              <div className="flex items-center gap-2">
                <UserCog size={18} className="text-primary" />
                <h3 className="font-display text-xl font-semibold text-foreground">指导老师</h3>
              </div>
              <div className="mt-5 flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:p-8">
                <div className="mx-auto h-40 w-40 shrink-0 overflow-hidden rounded-xl bg-accent/40 sm:mx-0">
                  {advisor.photo_url ? (
                    <Image src={advisor.photo_url} fittingType="fill" className="h-full w-full" />
                  ) : (
                    <div className="flex h-full items-center justify-center font-display text-5xl font-bold text-primary/30">{advisor.name?.[0] || '?'}</div>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-display text-2xl font-bold text-foreground">{advisor.name}</h4>
                  {advisor.title && <p className="mt-1 text-primary">{advisor.title}</p>}
                  {advisor.research_interests && (
                    <div className="mt-4">
                      <p className="font-mono-date text-xs uppercase tracking-widest text-muted-foreground">研究方向</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{advisor.research_interests}</p>
                    </div>
                  )}
                  {advisor.bio && (
                    <div className="mt-4">
                      <p className="font-mono-date text-xs uppercase tracking-widest text-muted-foreground">简介</p>
                      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{advisor.bio}</p>
                    </div>
                  )}
                  {advisor.email && (
                    <a href={`mailto:${advisor.email}`} className="mt-4 flex items-center gap-2 text-sm text-primary hover:underline"><Mail size={15} /> {advisor.email}</a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* In-school members */}
          <div className="mt-14">
            <div className="flex items-center gap-2">
              <GraduationCap size={18} className="text-primary" />
              <h3 className="font-display text-xl font-semibold text-foreground">在校成员</h3>
            </div>
            {inSchool.length === 0 ? (
              <p className="mt-5 rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">暂无在校成员</p>
            ) : (
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {inSchool.map((m) => <MemberCard key={m.id} m={m} onClick={setFocus} />)}
              </div>
            )}
          </div>

          {/* Graduated members */}
          {graduated.length > 0 && (
            <div className="mt-14">
              <div className="flex items-center gap-2">
                <Compass size={18} className="text-primary" />
                <h3 className="font-display text-xl font-semibold text-foreground">已毕业成员</h3>
              </div>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {graduated.map((m) => <MemberCard key={m.id} m={m} onClick={setFocus} />)}
              </div>
            </div>
          )}
        </>
      )}

      <FocusPanel member={focus} onClose={() => setFocus(null)} />
    </div>
  );
}