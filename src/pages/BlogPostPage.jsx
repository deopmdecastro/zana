import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';

export default function BlogPostPage() {
  const postId = window.location.pathname.split('/blog/')[1];

  const { data: post, isLoading } = useQuery({
    queryKey: ['blog-post', postId],
    queryFn: () => base44.entities.BlogPost.filter({ id: postId }),
    select: (data) => data[0],
    enabled: !!postId,
  });

  if (isLoading) {
    return <div className="max-w-3xl mx-auto px-4 py-20 animate-pulse"><div className="h-8 bg-secondary/50 w-2/3 rounded" /></div>;
  }

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="font-heading text-2xl">Artigo não encontrado</p>
        <Link to="/blog" className="font-body text-sm text-primary mt-4 inline-block">← Voltar ao blog</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <Link to="/blog" className="inline-flex items-center gap-1 text-sm font-body text-muted-foreground hover:text-primary mb-8">
        <ChevronLeft className="w-4 h-4" /> Voltar ao blog
      </Link>

      {post.image_url && (
        <div className="aspect-[16/9] rounded-lg overflow-hidden mb-8">
          <img src={post.image_url} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}

      <span className="font-body text-xs text-muted-foreground flex items-center gap-1 mb-3">
        <Calendar className="w-3 h-3" />
        {format(new Date(post.created_date), 'd MMMM yyyy', { locale: pt })}
      </span>

      <h1 className="font-heading text-3xl md:text-5xl font-light mb-8">{post.title}</h1>

      <div className="prose prose-sm max-w-none font-body text-foreground/80 leading-relaxed">
        <ReactMarkdown>{post.content}</ReactMarkdown>
      </div>
    </div>
  );
}