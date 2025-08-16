import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NewsAudio {
  id: number;
  Titulo: string | null;
  capa: string | null;
  data: string | null;
}

export const useNewsNotifications = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNews, setRecentNews] = useState<NewsAudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Buscar últimas notícias
        const { data: news, error: newsError } = await supabase
          .from('NOTICIAS-AUDIO')
          .select('id, Titulo, capa, data')
          .order('id', { ascending: false })
          .limit(10);

        if (newsError) throw newsError;
        setRecentNews(news || []);

        // Se usuário logado, contar não lidas
        if (user) {
          const { data: countData, error: countError } = await supabase
            .rpc('get_unread_news_count', { user_uuid: user.id });

          if (countError) throw countError;
          setUnreadCount(countData || 0);
        } else {
          setUnreadCount(news?.length || 0);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar notificações');
        console.error('Erro ao buscar notificações:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    // Subscription para real-time updates
    const subscription = supabase
      .channel('news-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'NOTICIAS-AUDIO'
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const markAsRead = async (newsId: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.rpc('mark_news_as_read', {
        user_uuid: user.id,
        news_uuid: newsId.toString()
      });

      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Erro ao marcar como lida:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      for (const news of recentNews) {
        await supabase.rpc('mark_news_as_read', {
          user_uuid: user.id,
          news_uuid: news.id.toString()
        });
      }

      setUnreadCount(0);
    } catch (err) {
      console.error('Erro ao marcar todas como lidas:', err);
    }
  };

  const clearNotificationCount = () => {
    setUnreadCount(0);
  };

  const clearAllNotifications = () => {
    setUnreadCount(0);
    setRecentNews([]);
  };

  return {
    unreadCount,
    recentNews,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    clearNotificationCount,
    clearAllNotifications
  };
};