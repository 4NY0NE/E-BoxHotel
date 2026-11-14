/**
 * E-BoxHotel — configuração do ambiente.
 * Preencha com os dados do projeto Supabase (Project Settings > API). A chave "anon" é pública por
 * projeto: a proteção dos dados vem das políticas RLS do banco (supabase/schema.sql), nunca desta chave.
 * NUNCA coloque aqui a chave "service_role".
 * Em branco = modo local de demonstração (contas e reservas ficam só neste navegador).
 */
(function (root) {
  'use strict';
  root.HB = root.HB || {};
  root.HB.config = Object.freeze({
    supabaseUrl: 'https://gigygvqesuqxzswmsnym.supabase.co',
    supabaseAnonKey: 'sb_publishable_qzlXGVoX_NWdPeur4UzGnA_Tl3Iz1N7',
  });
})(typeof window !== 'undefined' ? window : globalThis);
