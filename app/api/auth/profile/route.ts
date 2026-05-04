import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';

export async function GET(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
  }
  return NextResponse.json({ message: 'Perfil autenticado com sucesso!', user });
}
