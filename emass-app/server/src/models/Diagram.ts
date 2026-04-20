import { Schema, model, Document } from 'mongoose'

export type DiagramType =
  | 'Authorization Boundary'
  | 'Network'
  | 'Data Flow'
  | 'Hardware'
  | 'Software'
  | 'Other'

export interface IDiagram extends Document<string> {
  userId: string
  systemId: string
  name: string
  diagramType: DiagramType
  description: string
  filename: string
  originalName: string
  mimeType: string
  size: number
}

const diagramSchema = new Schema<IDiagram>(
  {
    _id: { type: String },
    userId: { type: String, required: true },
    systemId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    diagramType: { type: String, required: true },
    description: { type: String, default: '' },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: true }
)

diagramSchema.set('toJSON', {
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

export const Diagram = model<IDiagram>('Diagram', diagramSchema)
