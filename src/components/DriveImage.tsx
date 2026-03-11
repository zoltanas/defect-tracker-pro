import React from 'react';
import { useDriveFile } from '../hooks/useDriveFile';

interface DriveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

export function DriveImage({ src, alt, className, ...props }: DriveImageProps) {
  const { blobUrl, loading, error } = useDriveFile(src);

  if (loading) {
    return <div className={`flex items-center justify-center bg-zinc-100 ${className}`}>Loading image...</div>;
  }

  if (error) {
    return <div className={`flex items-center justify-center bg-zinc-100 text-red-500 text-sm ${className}`}>Failed to load image</div>;
  }

  return <img src={blobUrl || src} alt={alt} className={className} {...props} />;
}
