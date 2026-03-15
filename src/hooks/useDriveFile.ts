import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { get, set } from 'idb-keyval';

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

    let isMounted = true;
    let currentBlobUrl: string | null = null;
    
    const loadFile = async () => {
      setLoading(true);
      setError(null);

      try {
        const cacheKey = `drive-file-${fileId}`;
        const cachedBlob = await get<Blob>(cacheKey);
        
        if (cachedBlob) {
          if (isMounted) {
            currentBlobUrl = URL.createObjectURL(cachedBlob);
            setBlobUrl(currentBlobUrl);
            setLoading(false);
          }
          return;
        }

        if (!user?.accessToken) {
          throw new Error('Not authenticated');
        }

        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: {
            Authorization: `Bearer ${user.accessToken}`
          }
        });

        if (!res.ok) throw new Error('Failed to fetch file');
        
        const blob = await res.blob();
        await set(cacheKey, blob);

        if (isMounted) {
          currentBlobUrl = URL.createObjectURL(blob);
          setBlobUrl(currentBlobUrl);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error fetching Drive file:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    };

    loadFile();

    return () => {
      isMounted = false;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [url, user?.accessToken]);

  return { blobUrl, loading, error };
}
