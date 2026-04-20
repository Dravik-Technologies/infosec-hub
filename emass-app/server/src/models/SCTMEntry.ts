import { Schema, model, Document } from 'mongoose'

export interface ISCTMEntry extends Document {
  userId: string
  systemId: string
  controlId: string
  status: string
  implementationOrigin: string
  responsibleRole: string
  implementationStatement: string
  assessorNotes: string
  evidenceLinks: Array<{
    id: string
    label: string
    url: string
    addedAt: string
  }>
  inheritedFrom: string | null
  targetCompletionDate: string | null
}

const sctmEntrySchema = new Schema<ISCTMEntry>(
  {
    userId: { type: String, required: true },
    systemId: { type: String, required: true, index: true },
    controlId: { type: String, required: true },
    status: { type: String, default: 'Not Implemented' },
    implementationOrigin: { type: String, default: 'System Specific' },
    responsibleRole: { type: String, default: '' },
    implementationStatement: { type: String, default: '' },
    assessorNotes: { type: String, default: '' },
    evidenceLinks: [
      {
        id: String,
        label: String,
        url: String,
        addedAt: String,
      },
    ],
    inheritedFrom: { type: String, default: null },
    targetCompletionDate: { type: String, default: null },
  },
  { timestamps: true }
)

sctmEntrySchema.index({ systemId: 1, controlId: 1 }, { unique: true })

sctmEntrySchema.set('toJSON', {
  transform: (_: any, ret: any) => {
    ret.id = `${ret.systemId}-${ret.controlId}`
    ret.createdAt = ret.createdAt?.toISOString?.() ?? ret.createdAt
    ret.updatedAt = ret.updatedAt?.toISOString?.() ?? ret.updatedAt
    delete ret._id
    delete ret.__v
    delete ret.userId
    return ret
  },
})

export const SCTMEntry = model<ISCTMEntry>('SCTMEntry', sctmEntrySchema)
