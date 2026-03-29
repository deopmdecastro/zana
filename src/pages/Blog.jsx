import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import ImageWithFallback from '@/components/ui/image-with-fallback';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

const categoryLabels = {
  tendencias: 'Tendências',
  dicas: 'Dicas',
  novidades: 'Novidades',
  inspiracao: 'Inspiração',
};

export default function Blog() {
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['blog-posts'],
    queryFn: () => base44.entities.BlogPost.filter({ status: 'published' }, '-created_date', 50),
  });

  return (
    <div className="min-h-screen">
      <div className="bg-primary py-12 md:py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="font-body text-xs tracking-[0.3em] uppercase text-primary-foreground/60 mb-2">Inspiração</p>
          <h1 className="font-heading text-4xl md:text-6xl text-primary-foreground font-light">Blog</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-secondary/50 aspect-[16/9] rounded-lg mb-4" />
                <div className="h-4 bg-secondary/50 w-1/3 rounded mb-2" />
                <div className="h-6 bg-secondary/50 w-2/3 rounded" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-heading text-2xl text-muted-foreground mb-2">Em Breve</p>
            <p className="font-body text-sm text-muted-foreground">Estamos a preparar conteúdo inspirador para si.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {posts.map((post, i) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="group"
              >
                <Link to={`/blog/${post.id}`}>
                  {post.image_url && (
                    <div className="aspect-[16/9] rounded-lg overflow-hidden mb-4">
                      <ImageWithFallback
                        src={post.image_url}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        iconClassName="w-12 h-12 text-muted-foreground/40"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-2">
                    {post.category && (
                      <span className="font-body text-[10px] tracking-wider uppercase text-accent font-semibold">
                        {categoryLabels[post.category] || post.category}
                      </span>
                    )}
                    <span className="font-body text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(post.created_date), 'd MMM yyyy', { locale: pt })}
                    </span>
                  </div>
                  <h2 className="font-heading text-xl md:text-2xl group-hover:text-primary transition-colors">{post.title}</h2>
                  {post.excerpt && (
                    <p className="font-body text-sm text-muted-foreground mt-2 line-clamp-2">{post.excerpt}</p>
                  )}
                </Link>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}