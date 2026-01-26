"use client";

import React from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock } from "lucide-react";

const LoginPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md rounded-xl shadow-lg border-none p-6 bg-card">
        <CardHeader className="text-center mb-6">
          <Lock className="h-16 w-16 mx-auto text-primary mb-4" />
          <CardTitle className="text-3xl font-bold text-primary">Bem-vindo de volta!</CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2">
            Faça login ou crie uma conta para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Auth
            supabaseClient={supabase}
            providers={[]} // Removendo provedores de terceiros para manter a simplicidade
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: "hsl(220 80% 50%)", // Cor primária do seu tema
                    brandAccent: "hsl(220 80% 60%)", // Cor de destaque
                    defaultButtonBackground: "hsl(220 80% 50%)",
                    defaultButtonBackgroundHover: "hsl(220 80% 60%)",
                    defaultButtonBorder: "hsl(220 80% 50%)",
                    defaultButtonText: "hsl(0 0% 98%)",
                    inputBackground: "hsl(var(--input))",
                    inputBorder: "hsl(var(--border))",
                    inputBorderHover: "hsl(var(--ring))",
                    inputBorderFocus: "hsl(var(--ring))",
                    inputText: "hsl(var(--foreground))",
                    inputLabelText: "hsl(var(--foreground))",
                  },
                  radii: {
                    borderRadiusButton: "0.75rem",
                    button: "0.75rem",
                    input: "0.75rem",
                  },
                },
              },
            }}
            theme="light" // Usando o tema claro
            localization={{
              variables: {
                sign_in: {
                  email_label: "Seu e-mail",
                  password_label: "Sua senha",
                  email_input_placeholder: "Digite seu e-mail",
                  password_input_placeholder: "Digite sua senha",
                  button_label: "Entrar",
                  social_auth_button_text: "Entrar com {{provider}}",
                  link_text: "Já tem uma conta? Entrar",
                  forgotten_password: "Esqueceu sua senha?",
                  confirmation_text: "Verifique seu e-mail para o link de login",
                },
                sign_up: {
                  email_label: "Seu e-mail",
                  password_label: "Crie uma senha",
                  email_input_placeholder: "Digite seu e-mail",
                  password_input_placeholder: "Crie sua senha",
                  button_label: "Registrar",
                  social_auth_button_text: "Registrar com {{provider}}",
                  link_text: "Não tem uma conta? Registrar",
                  confirmation_text: "Verifique seu e-mail para o link de confirmação",
                },
                forgotten_password: {
                  email_label: "Seu e-mail",
                  email_input_placeholder: "Digite seu e-mail para redefinir",
                  button_label: "Enviar instruções de redefinição",
                  link_text: "Esqueceu sua senha?",
                  confirmation_text: "Verifique seu e-mail para o link de redefinição de senha",
                },
                update_password: {
                  password_label: "Nova senha",
                  password_input_placeholder: "Digite sua nova senha",
                  button_label: "Atualizar senha",
                  confirmation_text: "Sua senha foi atualizada",
                },
                magic_link: {
                  email_input_placeholder: "Digite seu e-mail",
                  button_label: "Enviar link mágico",
                  link_text: "Enviar um link mágico",
                  confirmation_text: "Verifique seu e-mail para o link mágico",
                },
                verify_otp: {
                  email_input_placeholder: "Digite seu e-mail",
                  phone_input_placeholder: "Digite seu número de telefone",
                  token_input_placeholder: "Código OTP",
                  button_label: "Verificar OTP",
                  link_text: "Já tem um código OTP? Verifique",
                },
              },
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;