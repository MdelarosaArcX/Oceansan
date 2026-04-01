import mongoose, { Schema, Document } from "mongoose";

export interface IFileMeta {
  file_name: string;
  extension: string;
  size: number;
  created_at: Date;
  modified_at: Date;
  metadata?: any;
}

export interface IFileMetadata extends Document {
  path: string; // normalized folder path, unique
  files: IFileMeta[];
  createdAt?: Date;
  updatedAt?: Date;
}

const FileMetaSchema = new Schema<IFileMeta>(
  {
    file_name: { type: String, required: true },
    extension: { type: String },
    size: { type: Number, required: true },
    created_at: { type: Date },
    modified_at: { type: Date },
    metadata: { type: Schema.Types.Mixed }, // optional extra metadata
  },
  { _id: false } // don't create _id for each file entry
);

const FileMetadataSchema = new Schema<IFileMetadata>(
  {
    path: { type: String, required: true, unique: true },
    files: [FileMetaSchema],
  },
  { timestamps: true }
);

export default mongoose.model<IFileMetadata>(
  "FileMetadata",
  FileMetadataSchema
);
