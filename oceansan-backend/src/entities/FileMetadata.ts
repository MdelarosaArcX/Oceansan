import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Unique
} from "typeorm";
import { Directories } from "./Directories";

@Entity("file_metadata")
@Unique(["fileName", "directory"])
export class FileMetadata {

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fileName: string;

  @Column()
  extension: string;

  @Column()
  size: number;

  @Column({ type: "json", nullable: true })
  metadata: any;

  @ManyToOne(() => Directories, (dir) => dir.files)
  @JoinColumn({ name: "directoryId" })
  directory: Directories;

  @Column()
  directoryId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}