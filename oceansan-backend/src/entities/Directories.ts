import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { FileMetadata } from "./FileMetadata";

@Entity("directories")
export class Directories {

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  path: string;

  @OneToMany(() => FileMetadata, (file) => file.directory, {
    cascade: true,
  })
  files: FileMetadata[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}