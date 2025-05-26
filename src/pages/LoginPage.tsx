import React, { useState } from 'react';
import { Button } from '@mui/material';
import { TextField } from '@mui/material';
import { Typography } from '@mui/material';
import { Alert, AlertTitle, AlertProps } from '@mui/material';
import { AlertCircle } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Box } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { useNavigate } from 'react-router-dom';
import { useApp, loadClientContextData } from '../contexts/AppContext';
import { fetchApi } from '../utils/fetchApi';

// Define el esquema de validación con Zod
const loginSchema = z.object({
    username: z.string(),
    password: z.string(),
});

// Define el tipo para los datos del formulario
type LoginFormValues = z.infer<typeof loginSchema>;



const LoginPage = () => {
    const navigate = useNavigate(); // Usamos useNavigate
    const [loginError, setLoginError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const {
        control,
        handleSubmit,
        formState: { errors },
        reset
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            username: '',
            password: '',
        },
    });
    const { setIsLoggedIn, setClientContext } = useApp(); // Obtiene el estado de login del contexto
    const onSubmit = async (data: LoginFormValues) => {
        setIsSubmitting(true);
        setLoginError(null); // Limpia cualquier error anterior
        try {
            const formData = new URLSearchParams({
                username: data.username,
                password: data.password
            });
            const loginResponse = await fetchApi('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData,
            });
            if (!loginResponse.url.endsWith('/menu')){
                throw new Error('Error al iniciar sesión');
            }
            // Si el login fue exitoso, procede a cargar todos los datos de contexto
            const loadedContext = await loadClientContextData();
            setClientContext(loadedContext); // Actualiza el estado global con los datos de contexto
            setIsLoggedIn(true);
            navigate('/home');
            reset();
        } catch (error: any) {
            setIsLoggedIn(false);
            setLoginError(error.message || 'Ocurrió un error al iniciar sesión');
        } finally {
            setIsSubmitting(false);
        }
    };

    const alertProps: AlertProps = {
        severity: "error"
    }

    return (
        <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            minHeight="100vh"
            bgcolor="#f5f5f5"
        >
            <Box
                width="100%"
                maxWidth="400px"
                padding={4}
                bgcolor="white"
                borderRadius={8}
                boxShadow={3}
            >
                <Typography variant="h5" align="center" gutterBottom>
                    Iniciar Sesión
                </Typography>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <label htmlFor="username">
                            <Typography variant="subtitle1" component="div" sx={{ fontWeight: 'medium' }}>
                                Usuario
                            </Typography>
                         </label>
                        <Controller
                            name="username"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    type="username"
                                    placeholder="Ingresa tu usuario"
                                    fullWidth
                                    margin="normal"
                                    error={!!errors.username}
                                    helperText={errors.username?.message}
                                    disabled={isSubmitting}
                                />
                            )}
                        />
                    </div>
                    <div>
                        <label htmlFor="password">
                            <Typography variant="subtitle1" component="div" sx={{ fontWeight: 'medium' }}>
                                Contraseña
                            </Typography>
                        </label>
                        <Controller
                            name="password"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    type="password"
                                    placeholder="Ingresa tu contraseña"
                                    fullWidth
                                    margin="normal"
                                    error={!!errors.password}
                                    helperText={errors.password?.message}
                                    disabled={isSubmitting}
                                />
                            )}
                        />
                    </div>
                    <Button type="submit" fullWidth variant="contained" color="primary" disabled={isSubmitting} sx={{ mt: 2 }}>
                        {isSubmitting ? (
                            <>
                                <CircularProgress size={20} sx={{ mr: 1 }} />
                                Iniciando sesión...
                            </>
                        ) : (
                            'Iniciar Sesión'
                        )}
                    </Button>
                </form>
                {loginError && (
                    <Alert {...alertProps} sx={{ mt: 2 }}>
                        <AlertCircle fontSize="small" />
                        <AlertTitle>Error</AlertTitle>
                         {loginError}
                    </Alert>
                )}
            </Box>
        </Box>
    );
};
export default LoginPage;
