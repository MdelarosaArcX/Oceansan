import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { FileMetadata } from "./FileMetadata";

@Entity("file_meta")
export class FileMeta {

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  file_name: string;

  @Column({ nullable: true })
  extension: string;

  @Column("bigint")
  size: number;

  @Column({ type: "datetime", nullable: true })
  created_at: Date;

  @Column({ type: "datetime", nullable: true })
  modified_at: Date;

  @Column({ type: "json", nullable: true })
  metadata: any;

  @ManyToOne(() => FileMetadata, (metadata) => metadata.files, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "file_metadata_id" })
  fileMetadata: FileMetadata;
}