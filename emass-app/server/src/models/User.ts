import { Schema, model, Document } from 'mongoose'
import bcrypt from 'bcryptjs'

export interface IUser extends Document {
  username: string
  email: string
  passwordHash: string
  comparePassword(password: string): Promise<boolean>
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
)

userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash)
}

userSchema.set('toJSON', {
  transform: (_: any, ret: any) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    delete ret.passwordHash
    return ret
  },
})

export const User = model<IUser>('User', userSchema)
