import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("licenses")
export class License {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column()
  key!: string;

  @Column({ type: "datetime", nullable: true })
  expiresAt!: Date | null;

  @Column({ type: "text", nullable: true })
  note!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
