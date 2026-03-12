import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { FileMeta } from "./FileMeta";

@Entity("file_metadata")
export class FileMetadata {

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  path: string;

  @OneToMany(() => FileMeta, (file) => file.fileMetadata, {
    cascade: true,
  })
  files: FileMeta[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}