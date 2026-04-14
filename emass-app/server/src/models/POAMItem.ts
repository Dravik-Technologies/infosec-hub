import { Schema, model, Document, Types } from 'mongoose'

export interface IPOAMItem extends Document<string> {
  userId: Types.ObjectId
  systemId: string
  poamId: string
  weakness: string
  description: string
  findingSource: string
  severity: string
  relatedControls: string[]
  responsibleOffice: string
  scheduledCompletionDate: string
  milestones: Array<{
    id: string
    description: string
    scheduledDate: string
    completedDate: string | null
    status: string
    createdAt: string
    updatedAt: string
  }>
  mitigationDescription: string
  status: string
  discoveryDate: string
  closedDate: string | null
  vulnerabilityId: string | null
  cveId: string | null
  resourcesRequired: string
  estimatedCost: number | null
}

const milestoneSchema = new Schema(
  {
    id: String,
    description: String,
    scheduledDate: String,
    completedDate: { type: String, default: null },
    status: String,
    createdAt: String,
    updatedAt: String,
  },
  { _id: false }
)

const poamItemSchema = new Schema<IPOAMItem>(
  {
    _id: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    systemId: { type: String, required: true, index: true },
    poamId: { type: String, required: true },
    weakness: String,
    description: String,
    findingSource: String,
    severity: String,
    relatedControls: [String],
    responsibleOffice: String,
    scheduledCompletionDate: String,
    milestones: [milestoneSchema],
    mitigationDescription: String,
    status: String,
    discoveryDate: String,
    closedDate: { type: String, default: null },
    vulnerabilityId: { type: String, default: null },
    cveId: { type: String, default: null },
    resourcesRequired: String,
    estimatedCost: { type: Number, default: null },
  },
  { timestamps: true }
)

poamItemSchema.set('toJSON', {
  transform: (_: any, ret: any) => {
    ret.id = ret._id
    ret.createdAt = ret.createdAt?.toISOString?.() ?? ret.createdAt
    ret.updatedAt = ret.updatedAt?.toISOString?.() ?? ret.updatedAt
    delete ret._id
    delete ret.__v
    delete ret.userId
    return ret
  },
})

export const POAMItem = model<IPOAMItem>('POAMItem', poamItemSchema)
