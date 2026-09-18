import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

import { base44 } from '@/api/base44Client';
import { getErrorMessage } from '@/lib/toast';
import { useAuth } from '@/lib/AuthContext';
import ImageWithFallback from '@/components/ui/image-with-fallback';
import QuickAppointmentDialog from '@/components/appointments/QuickAppointmentDialog';
import HeroBanner from '@/components/home/HeroBanner';
import CategoryGrid from '@/components/home/CategoryGrid';
import AdBanner from '@/components/home/AdBanner';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import BrandBanner from '@/components/home/BrandBanner';
import Testimonials from '@/components/home/Testimonials';
import InstagramSection from '@/components/home/InstagramSection';

import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Calendar, CalendarClock, Clock, Mail, Sparkles } from 'lucide-react';

const sectionVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

function RevealSection({ children, className }) {
  return (
    <motion.section
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

export default function Home() {
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['content-landing'],
    queryFn: () => base44.content.landing(),
    staleTime: 60_000,
  });

  const landing = data?.content ?? null;

  const { data: apptSettings } = useQuery({
    queryKey: ['appointments-settings'],
    queryFn: () => base44.appointments.settings(),
    staleTime: 60_000,
  });

  const { data: apptServices } = useQuery({
    queryKey: ['appointments-services'],
    queryFn: () => base44.appointments.services(),
    staleTime: 60_000,
  });

  const apptEnabled = Boolean(apptSettings?.content?.enabled);
  const services = apptServices?.services ?? [];
  const homeCardImageUrl = String(apptSettings?.content?.home_card_image_url ?? '').trim();
  const homeCardEmptyTitle = String(apptSettings?.content?.home_card_empty_title ?? '').trim();
  const homeCardEmptyDescription = String(apptSettings?.content?.home_card_empty_description ?? '').trim();
  const homeCardLoggedOutTitle = String(apptSettings?.content?.home_card_logged_out_title ?? '').trim();
  const homeCardLoggedOutDescription = String(apptSettings?.content?.home_card_logged_out_description ?? '').trim();

  const [quickOpen, setQuickOpen] = useState(false);
  const [quickServiceId, setQuickServiceId] = useState('');
  const quickService = useMemo(() => services.find((s) => s.id === quickServiceId) ?? null, [quickServiceId, services]);

  const { data: myAppointmentsRes } = useQuery({
    queryKey: ['appointments-my', 'home'],
    queryFn: () => base44.appointments.my(),
    enabled: apptEnabled && !!user,
    staleTime: 15_000,
    retry: false,
  });

  const nextAppointment = useMemo(() => {
    const appts = myAppointmentsRes?.appointments ?? [];
    const now = Date.now();
    return (
      appts
        .filter((a) => (a?.status === 'pending' || a?.status === 'confirmed') && new Date(a.start_at).getTime() >= now - 60_000)
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0] ?? null
    );
  }, [myAppointmentsRes?.appointments]);

  const subscribeMutation = useMutation({
    mutationFn: (email) => base44.newsletter.subscribe({ email }),
    onSuccess: () => {
      toast.success('Subscrição confirmada. Obrigado!');
      setNewsletterEmail('');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Não foi possível subscrever.')),
  });

  const formatApptDate = (value) => {
    try {
      return new Date(value).toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'long' });
    } catch {
      return '-';
    }
  };

  const formatApptTime = (value) => {
    try {
      return new Date(value).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '-';
    }
  };

  return (
    <div>
      <HeroBanner content={landing} />

      <RevealSection>
        <CategoryGrid content={landing} />
      </RevealSection>

      <AdBanner banner={landing?.ads?.before_highlights} />

      <RevealSection>
        <FeaturedProducts title="Destaques" filterKey="is_featured" />
      </RevealSection>

      <RevealSection>
        <FeaturedProducts title="Novidades" filterKey="is_new" />
      </RevealSection>

      {apptEnabled && (
        <RevealSection className="py-16">
          <div className="max-w-6xl mx-auto px-4">
            <QuickAppointmentDialog open={quickOpen} onOpenChange={setQuickOpen} service={quickService} />
            <div className="flex flex-col items-center text-center mb-12">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                <CalendarClock className="w-6 h-6" />
              </div>
              <h2 className="font-heading text-3xl md:text-4xl mb-3">Marcações</h2>
              <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto">
                Escolha o serviço, veja a sua próxima marcação e agende em poucos cliques.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:items-start">
              <div className="lg:col-span-5">
                <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm flex flex-col">
                  <div className="aspect-[4/3] bg-secondary/30">
                    <ImageWithFallback
                      src={nextAppointment?.service?.image_url || homeCardImageUrl}
                      alt={
                        nextAppointment?.service?.name
                          ? `Capa do serviço ${nextAppointment.service.name}`
                          : 'Capa de marcações'
                      }
                      className="w-full h-full object-cover select-none pointer-events-none"
                      iconClassName="w-16 h-16 text-muted-foreground/40"
                    />
                  </div>
                  <div className="p-6 sm:p-7 flex flex-col">
                    <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground font-body">
                      <span className="inline-flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        {nextAppointment ? formatApptDate(nextAppointment.start_at) : '—'}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        {nextAppointment ? formatApptTime(nextAppointment.start_at) : '—'}
                      </span>
                    </div>

                    <div className="mt-6 space-y-3">
                      <div className="font-heading text-xl leading-snug">
                        {user
                          ? nextAppointment
                            ? 'A sua próxima marcação'
                            : homeCardEmptyTitle || 'Sem marcações'
                          : homeCardLoggedOutTitle || 'Entre para ver as suas marcações'}
                      </div>
                      <p className="font-body text-sm text-muted-foreground leading-relaxed">
                        {nextAppointment
                          ? `${nextAppointment.service?.name ?? 'Serviço'} • ${nextAppointment.staff?.name ?? 'Atendente'}`
                          : user
                            ? homeCardEmptyDescription || 'Ainda não tem marcações confirmadas ou pendentes.'
                            : homeCardLoggedOutDescription || 'Faça login para ver a data e hora da sua próxima marcação.'}
                      </p>
                    </div>

                    <div className="mt-8">
                      <Button
                        asChild
                        variant="default"
                        className="w-full rounded-none font-body text-sm tracking-wider"
                      >
                        <Link to={user ? '/conta/marcacoes' : '/conta'}>{user ? 'Ver marcações' : 'Entrar'}</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {services.map((s) => (
                    <div
                      key={s.id}
                      className="bg-card rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
                    >
                      <div className="aspect-[4/3] bg-secondary/30 shrink-0">
                        <ImageWithFallback
                          src={s.image_url}
                          alt=""
                          className="w-full h-full object-cover opacity-95 select-none pointer-events-none"
                          iconClassName="w-16 h-16 text-muted-foreground/40"
                        />
                      </div>
                      <div className="p-6 text-center flex flex-col">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                          <CalendarClock className="w-5 h-5" />
                        </div>
                        <h3 className="font-heading text-xl mb-2">{s.name}</h3>
                        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground font-body mb-4">
                          <span className="inline-flex items-center gap-2">
                            <Clock className="w-4 h-4" /> {s.duration_minutes ?? 30} min
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-primary">{s.price ? `€${s.price}` : 'Grátis'}</p>
                        <div className="mt-6 w-full">
                          <Button
                            className="w-full rounded-none font-body text-sm tracking-wider"
                            onClick={() => {
                              setQuickServiceId(String(s.id));
                              setQuickOpen(true);
                            }}
                          >
                            Agendar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {services.length === 0 && (
                    <p className="col-span-full text-center text-muted-foreground py-12 font-body">
                      Sem serviços disponíveis no momento.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </RevealSection>
      )}

      <RevealSection>
        <BrandBanner content={landing} />
      </RevealSection>

      <AdBanner banner={landing?.ads?.before_testimonials} />

      <RevealSection>
        <Testimonials />
      </RevealSection>

      <RevealSection>
        <InstagramSection />
      </RevealSection>

      {landing?.newsletter?.enabled !== false ? (
        <section className="py-16 md:py-24 bg-primary relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-1/4 w-72 h-72 rounded-full bg-accent blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-primary-foreground blur-3xl" />
          </div>
          <div className="relative max-w-2xl mx-auto px-4 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="w-14 h-14 rounded-full bg-primary-foreground/10 border border-primary-foreground/20 flex items-center justify-center mx-auto mb-6"
            >
              <Mail className="w-6 h-6 text-primary-foreground" />
            </motion.div>

            <h2 className="font-heading text-3xl md:text-4xl text-primary-foreground mb-3">
              {landing?.newsletter?.title ?? 'Receba as Novidades'}
            </h2>
            <p className="font-body text-sm text-primary-foreground/70 mb-8 max-w-lg mx-auto">
              {landing?.newsletter?.text ??
                'Subscreva a nossa newsletter e fique a par das últimas coleções, promoções exclusivas e dicas de estilo.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const email = String(newsletterEmail ?? '').trim();
                    if (!email) return toast.error('Escreva o seu email.');
                    subscribeMutation.mutate(email);
                  }
                }}
                placeholder={landing?.newsletter?.placeholder ?? 'O seu email'}
                className="flex-1 px-4 py-3 bg-primary-foreground/10 border border-primary-foreground/20 rounded-none text-primary-foreground placeholder:text-primary-foreground/50 text-sm font-body focus:outline-none focus:border-primary-foreground/50 focus:bg-primary-foreground/15 transition-colors"
              />
              <button
                className="px-6 py-3 bg-primary-foreground text-primary text-sm font-body tracking-wider hover:bg-primary-foreground/90 transition-colors disabled:opacity-60 rounded-none flex items-center justify-center gap-2"
                disabled={subscribeMutation.isPending}
                onClick={() => {
                  const email = String(newsletterEmail ?? '').trim();
                  if (!email) return toast.error('Escreva o seu email.');
                  subscribeMutation.mutate(email);
                }}
              >
                {subscribeMutation.isPending ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    A subscrever...
                  </>
                ) : (
                  landing?.newsletter?.button_label ?? 'Subscrever'
                )}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
