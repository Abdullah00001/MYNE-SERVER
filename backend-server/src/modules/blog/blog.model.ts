import { Schema, model, Model } from 'mongoose';

import { IBlog } from '@/modules/blog/blog.types';

const BlogSchema = new Schema<IBlog>(
  {
    blogTitle: { type: String, minLength: 10, required: true },
    blogImage: { type: String, required: true },
    blogDescription: { type: String, minLength: 100, required: true },
  },
  { timestamps: true }
);

const Blog: Model<IBlog> = model<IBlog>('Blog', BlogSchema);

export default Blog;
