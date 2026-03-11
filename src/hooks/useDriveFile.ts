import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';

export function getDriveFileId(url: string): string | null {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return null;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export function useDriveFile(url: string) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useStore();

  useEffect(() => {
    const fileId = getDriveFileId(url);
    
    if (!fileId) {
      setBlobUrl(url);
      setLoading(false);
      setError(null);
      return;
    }

    if (!user?.accessToken) {
      setError(new Error('Not authenticated'));
      setLoading(false);
      return;
    }

    let isMounted = true;
    let currentBlobUrl: string | null = null;
    setLoading(true);
    setError(null);

    fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${user.accessToken}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch file');
        return res.blob();
      })
      .then(blob => {
        if (isMounted) {
          currentBlobUrl = URL.createObjectURL(blob);
          setBlobUrl(currentBlobUrl);
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error('Error fetching Drive file:', err);
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [url, user?.accessToken]);

  return { blobUrl, loading, error };
}
