import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, ChangePasswordDto } from './dto';
import { Public, CurrentUser, AuthUser } from './decorators';
import { IsString, IsNotEmpty } from 'class-validator';

class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('change-password')
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(
      user.userId,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
