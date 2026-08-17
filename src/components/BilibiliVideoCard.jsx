import React from 'react';
import MediaResourceCard from '@/components/MediaResourceCard';

export default function BilibiliVideoCard({ href, thumbnailUrl, title, description, meta, index = 0 }) {
  return <MediaResourceCard href={href} thumbnailUrl={thumbnailUrl} title={title} description={description} meta={meta} index={index} kind="video" action="visit" fileType="video" />;
}
