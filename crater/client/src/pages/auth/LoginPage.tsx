import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { authApi } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Required'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuth()
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ user, token }) => {
      setAuth(user, token)
      toast.success('ACCESS GRANTED')
      navigate('/dashboard')
    },
    onError: () => toast.error('ACCESS DENIED — check credentials'),
  })

  return (
    <div className="min-h-screen bg-space flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4"
            style={{ width: 56, height: 56, clipPath: 'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)', background: '#00F5FF' }}>
            <span className="font-mono font-bold text-xl text-space">C</span>
          </div>
          <p className="font-mono font-bold text-cyan-neon tracking-widest text-lg">CRATER</p>
          <p className="hud-label text-slate-600 mt-1">RMF COMMAND CENTER — AUTHENTICATE</p>
        </div>

        <form onSubmit={handleSubmit(d => login.mutate(d))} className="space-y-4">
          <div>
            <label className="hud-label mb-1.5 block">EMAIL</label>
            <input {...register('email')} type="email" className="input-hud" placeholder="operator@agency.gov" />
            {errors.email && <p className="font-mono text-red-alert text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="hud-label mb-1.5 block">PASSWORD</label>
            <input {...register('password')} type="password" className="input-hud" placeholder="••••••••" />
            {errors.password && <p className="font-mono text-red-alert text-xs mt-1">{errors.password.message}</p>}
          </div>
          <button type="submit" disabled={login.isPending} className="btn-primary w-full mt-2">
            {login.isPending ? 'AUTHENTICATING...' : 'AUTHENTICATE'}
          </button>
        </form>

        <p className="text-center mt-6 font-mono text-xs text-slate-600">
          NO ACCOUNT?{' '}
          <Link to="/register" className="text-cyan-neon/70 hover:text-cyan-neon transition-colors">
            REQUEST ACCESS
          </Link>
        </p>
      </div>
    </div>
  )
}
