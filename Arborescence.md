
/*
VAGONDYS/
┃
┣━ .next/                                          ✅ EXISTANT
┣━ .vscode                                         ✅ EXISTANT
┃  ┣━ .vercel/                                     ✅ EXISTANT
┃  ┃  ┣━ project.json                              ✅ EXISTANT
┃  ┃  ┗━ README.txt                                ✅ EXISTANT
┃  ┗━ settings.json                                ✅ EXISTANT
┣━ actions/
┃  ┣━ get-staff-config.ts                          ✅ EXISTANT
┃  ┗━ staff-actions.ts                             ✅ EXISTANT (Contient le Server Action)
┃
┣━ app/                                            ✅ EXISTANT
┃  ┣━ (auth)/                                      ✅ EXISTANT
┃  ┃  ┣━ activation-reussie/                       ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ carte-id/                                 ✅ EXISTANT
┃  ┃  ┃  ┣━ DocumentVault.tsx                      ✅ EXISTANT
┃  ┃  ┃  ┣━ page.tsx                               ✅ EXISTANT
┃  ┃  ┃  ┗━ ProfileForm.tsx                        ✅ EXISTANT
┃  ┃  ┣━ connexion/                                ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ espace-joueur/                            ✅ EXISTANT
┃  ┃  ┃  ┣━ components/                            ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ cibles/                             ✅ EXISTANT
┃  ┃  ┃  ┃  ┃  ┣━ CibleDetail.css                  ✅ EXISTANT
┃  ┃  ┃  ┃  ┃  ┣━ CibleDetail.tsx                  ✅ EXISTANT
┃  ┃  ┃  ┃  ┃  ┣━ CibleSimple.tsx                  ✅ EXISTANT
┃  ┃  ┃  ┃  ┃  ┣━ FleurCibles.css                  ✅ EXISTANT
┃  ┃  ┃  ┃  ┃  ┣━ FleurCibles.tsx                  ✅ EXISTANT
┃  ┃  ┃  ┃  ┃  ┣━ FleurDeCiblesWidget.css          ✅ EXISTANT
┃  ┃  ┃  ┃  ┃  ┣━ FleurDeCiblesWidget.tsx          ✅ EXISTANT
┃  ┃  ┃  ┃  ┃  ┣━ FlowerCibleCamembertWidget.css   ✅ EXISTANT
┃  ┃  ┃  ┃  ┃  ┣━ FlowerCibleCamembertWidget.tsx   ✅ EXISTANT
┃  ┃  ┃  ┃  ┃  ┣━ FullscreenCibles.css             ✅ EXISTANT
┃  ┃  ┃  ┃  ┃  ┣━ FullscreenCibles.tsx             ✅ EXISTANT
┃  ┃  ┃  ┃  ┃  ┗━ types.tsx                        ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ ArchiveViewer.tsx                   ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ GlobalProgressBar.css               ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ GlobalProgressBar.css               ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ GlobalProgressBar.tsx               ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ PrecisionBar.css                    ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ PrecisionBar.tsx                    ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ RankCard.tsx                        ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ ScoreChart.css                      ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ ScoreChart.tsx                      ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ StatsCard.tsx                       ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ TournamentHistory.tsx               ✅ EXISTANT
┃  ┃  ┃  ┣━ messagerie/                            ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ actions.tsx                         ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ page.tsx                            ✅ EXISTANT
┃  ┃  ┃  ┣━ types/                                 ✅ EXISTANT
┃  ┃  ┃  ┃   ┗━ index.ts                           ✅ EXISTANT
┃  ┃  ┃  ┣━ utils/                                 ✅ EXISTANT
┃  ┃  ┃  ┃   ┗━ formatters.ts                      ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ inscription/                              ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┗━ messagerie/                               ✅ EXISTANT
┃  ┃     ┣━ components/                            ✅ EXISTANT
┃  ┃     ┃  ┣━ MessageInput.tsx                    ✅ EXISTANT
┃  ┃     ┃  ┣━ MessageList.tsx                     ✅ EXISTANT
┃  ┃     ┃  ┗━ MessageThread.tsx                   ✅ EXISTANT
┃  ┃     ┣━ actions.ts                             ✅ EXISTANT
┃  ┃     ┣━ layout.tsx                             ✅ EXISTANT
┃  ┃     ┗━ page.tsx                               ✅ EXISTANT
┃  ┃
┃  ┣━ (public)/                                    ✅ EXISTANT
┃  ┃  ┣━ bareme/                                   ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ classements/                              ✅ EXISTANT
┃  ┃  ┃  ┣━ archives/                              ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ page.tsx                            ✅ EXISTANT
┃  ┃  ┃  ┣━ saison/                                ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ [year]/                             ✅ EXISTANT
┃  ┃  ┃  ┃     ┗━ page.tsx                         ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ communication/                            ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ competition/                              ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ contact/                                  ✅ EXISTANT
┃  ┃  ┃  ┣━ actions.tsx                            ✅ EXISTANT
┃  ┃  ┃  ┣━ page.tsx                               ✅ EXISTANT
┃  ┃  ┃  ┗━ SubmitButton.tsx                       ✅ EXISTANT
┃  ┃  ┣━ evenementiels/                            ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ joueurs/                                  ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ la-ligue/                                 ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ leaders/                                  ✅ EXISTANT
┃  ┃  ┃  ┣━ historique/                            ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ page.tsx                            ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ maison/                                   ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ mentions-legales/                         ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ messagerie/                               ✅ EXISTANT
┃  ┃  ┃  ┣━ connexion/                             ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ page.tsx                            ✅ EXISTANT
┃  ┃  ┃  ┣━ inscription/                           ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ actions.tsx                         ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ page.tsx                            ✅ EXISTANT
┃  ┃  ┃  ┗━ set-password/                          ✅ EXISTANT
┃  ┃  ┃     ┗━ page.tsx                            ✅ EXISTANT
┃  ┃  ┣━ politique-de-confidentialite/             ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ sponsors/                                 ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ tournois/                                 ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ layout.tsx                                ✅ EXISTANT
┃  ┃  ┗━ page.tsx                                  ✅ EXISTANT
┃  ┃
┃  ┣━ admin/                                       ✅ EXISTANT
┃  ┃  ┣━ configuration/                            ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ dashboard/                                ✅ EXISTANT
┃  ┃  ┃  ┣━ page.module.css                        ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ login/                                    ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ logs/                                     ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ messagerie/                               ✅ EXISTANT
┃  ┃  ┃  ┣━ page.module.css                        ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ staff/                                    ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ verification/                             ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ villes/                                   ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ layout.tsx                                ✅ EXISTANT
┃  ┃  ┗━ page.tsx                                  ✅ EXISTANT
┃  ┃
┃  ┣━ api/                                         ✅ EXISTANT
┃  ┃  ┣━ admin/                                    ✅ EXISTANT
┃  ┃  ┃  ┣━ stats/                                 ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┗━ verify/                                ✅ EXISTANT
┃  ┃  ┃     ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┣━ archive-external/                         ✅ EXISTANT
┃  ┃  ┃  ┣━ find-by-email/                         ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ restore/                               ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ archive-year                              ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ as-eg/                                    ✅ EXISTANT
┃  ┃  ┃  ┗━ session/                               ✅ EXISTANT
┃  ┃  ┃     ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┣━ auth/                                     ✅ EXISTANT
┃  ┃  ┃  ┗━ signup/                                ✅ EXISTANT
┃  ┃  ┃     ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┣━ check-athlete/                            ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ confirm-email/                            ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ confirm-signal/                           ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ cron/                                     ✅ EXISTANT
┃  ┃  ┃  ┗━ recalculate-rankings/                  ✅ EXISTANT
┃  ┃  ┃     ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┣━ debug-env/                                ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ force-admin/                              ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ get-athelete-data/                        ✅ EXISTANT
┃  ┃  ┃  ┗━ dossier/                               ✅ EXISTANT
┃  ┃  ┃     ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┣━ messagerie/                               ✅ EXISTANT
┃  ┃  ┃  ┣━ approve/                               ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ chek-account/                          ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ confirm/                               ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ conversations/                         ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ messages/                              ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┗━ set-password/                          ✅ EXISTANT
┃  ┃  ┃     ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┣━ notify-read/                              ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ player/                                   ✅ EXISTANT
┃  ┃  ┃  ┣━ matches/                               ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ message/                               ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ profile/                               ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┗━ token/                                 ✅ EXISTANT
┃  ┃  ┃     ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┣━ rankings/                                 ✅ EXISTANT
┃  ┃  ┃  ┗━ global/                                ✅ EXISTANT
┃  ┃  ┃     ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┣━ scan-document/                            ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ send-reply/                               ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ slots/                                    ✅ EXISTANT
┃  ┃  ┃  ┣━ [id]/                                  ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ staff/                                    ✅ EXISTANT
┃  ┃  ┃  ┣━ dashboard/                             ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ history/                               ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ messagerie-requests/                   ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ notify-transfer/                       ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ pending-signals/                       ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ public-data/                           ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┗━ register-athlete/                      ✅ EXISTANT
┃  ┃  ┃     ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┣━ tournaments/                              ✅ EXISTANT
┃  ┃  ┃  ┣━ rankings/                              ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┗━ record-result/                         ✅ EXISTANT
┃  ┃  ┃     ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┣━ upload-document/                          ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┗━ upload-temp/                              ✅ EXISTANT
┃  ┃     ┗━ route.ts                               ✅ EXISTANT
┃  ┃
┃  ┣━ staff/                                       ✅ EXISTANT
┃  ┃  ┣━ competitions/                             ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ components/                               ✅ EXISTANT
┃  ┃  ┃  ┣━ dashboard/                             ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ CityInfoCard.tsx                    ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ NavigationGrid.tsx                  ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ RecentActivity.tsx                  ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ StatsGrid.tsx                       ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ TopPlayers.tsx                      ✅ EXISTANT
┃  ┃  ┃  ┣━ ui/                                    ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ Badge.tsx                           ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ Card.tsx                            ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ LoadingSpinner.ts                   ✅ EXISTANT
┃  ┃  ┃  ┗━ AdminSidebar.tsx                       ✅ EXISTANT
┃  ┃  ┣━ hooks/                                    ✅ EXISTANT
┃  ┃  ┃  ┗━ useDashboardData.ts                    ✅ EXISTANT
┃  ┃  ┣━ interface/                                ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ licencies/                                ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ login/                                    ✅ EXISTANT
┃  ┃  ┃  ┣━ layout.tsx                             ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ mode_jeux/                                ✅ EXISTANT
┃  ┃  ┃  ┣━ components/                            ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ GameHeader.tsx                      ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ GameModeButton.tsx                  ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ GameModeSection.tsx                 ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ LaneSelector.tsx                    ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ LaneStatus.tsx                      ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ PlayerPseudoModal.tsx               ✅ EXISTANT
┃  ┃  ┃  ┣━ hooks/                                 ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ useGameModes.ts                     ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ useWebSocketManager.ts              ✅ EXISTANT
┃  ┃  ┃  ┣━ types/                                 ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ game.types.ts                       ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ index.ts                            ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ websocket.types.ts                  ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT (Ajout sélection couloirs)
┃  ┃  ┣━ reservations/                             ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ settings/                                 ✅ EXISTANT
┃  ┃  ┃  ┣━ actions.ts                             ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ types/                                    ✅ EXISTANT
┃  ┃  ┃  ┗━ dashboard.ts                           ✅ EXISTANT
┃  ┃  ┣━ layout.tsx                                ✅ EXISTANT
┃  ┃  ┗━ page.tsx                                  ✅ EXISTANT
┃  ┃
┃  ┣━ globals.css                                  ✅ EXISTANT
┃  ┣━ layout.tsx                                   ✅ EXISTANT
┃  ┣━ Maison.css                                   ✅ EXISTANT
┃  ┣━ manifest.ts                                  ✅ EXISTANT
┃  ┣━ Ranking.css                                  ✅ EXISTANT
┃  ┗━ sitemap.ts                                   ✅ EXISTANT
┃
┣━ components/                                     ✅ EXISTANT
┃  ┣━ staff/                                       ✅ EXISTANT
┃  ┃  ┣━ Sidebar.tsx                               ✅ EXISTANT
┃  ┃  ┗━ StaffShell.tsx                            ✅ EXISTANT
┃  ┣━ FileUploader.tsx                             ✅ EXISTANT
┃  ┗━ Footer.tsx                                   ✅ EXISTANT
┃
┣━ lib/                                            ✅ EXISTANT
┃  ┣━ archive/                                     ✅ EXISTANT
┃  ┃  ┗━ yearly-archiver.ts                        ✅ EXISTANT
┃  ┣━ archive-external/                            ✅ EXISTANT
┃  ┃  ┣━ db-client.ts                              ✅ EXISTANT
┃  ┃  ┣━ engine.ts                                 ✅ EXISTANT
┃  ┃  ┣━ gh-client.ts                              ✅ EXISTANT
┃  ┃  ┣━ types.t s                                 ✅ EXISTANT
┃  ┃  ┣━ utils.ts                                  ✅ EXISTANT
┃  ┃  ┗━ validator.ts                              ✅ EXISTANT
┃  ┣━ email/                                       ✅ EXISTANT
┃  ┃  ┗━ gmail.ts                                  ✅ EXISTANT
┃  ┣━ github-db/                                   ✅ EXISTANT
┃  ┃  ┣━ client.ts                                 ✅ EXISTANT
┃  ┃  ┣━ player.ts                                 ✅ EXISTANT
┃  ┃  ┣━ ranking.ts                                ✅ EXISTANT
┃  ┃  ┣━ request.ts                                ✅ EXISTANT
┃  ┃  ┗━ tournament.ts                             ✅ EXISTANT
┃  ┣━ hooks/                                       ✅ EXISTANT
┃  ┃  ┣━ useAudioControl.ts                        ✅ EXISTANT
┃  ┃  ┣━ usDashboardData.ts                        ✅ EXISTANT
┃  ┃  ┗━ usePhysicalButton.ts                      ✅ EXISTANT
┃  ┣━ storage/                                     ✅ EXISTANT
┃  ┃  ┗━ r2-client.ts                              ✅ EXISTANT
┃  ┣━ supabase/                                    ✅ EXISTANT
┃  ┃  ┣━ client.ts                                 ✅ EXISTANT
┃  ┃  ┣━ master.ts                                 ✅ EXISTANT
┃  ┃  ┣━ server.ts                                 ✅ EXISTANT
┃  ┃  ┗━ unified-client.ts                         ✅ EXISTANT
┃  ┣━ websocket/                                   ✅ EXISTANT
┃  ┃  ┗━ client.ts                                 ✅ EXISTANT
┃  ┗━ rate-limit.ts                                ✅ EXISTANT
┃
┣━ public/                                         ✅ EXISTANT
┃  ┣━ grades/                                      ✅ EXISTANT
┃  ┃  ┣━ guerrier_1.png                            ✅ EXISTANT
┃  ┃  ┣━ guerrier_2.png                            ✅ EXISTANT
┃  ┃  ┣━ guerrier_3.png                            ✅ EXISTANT
┃  ┃  ┣━ elite_1.png                               ✅ EXISTANT
┃  ┃  ┣━ elite_2.png                               ✅ EXISTANT
┃  ┃  ┣━ elite_3.png                               ✅ EXISTANT
┃  ┃  ┣━ maitre_1.png                              ✅ EXISTANT
┃  ┃  ┣━ maitre_2.png                              ✅ EXISTANT
┃  ┃  ┣━ maitre_3.png                              ✅ EXISTANT
┃  ┃  ┣━ grand_maitre_1.png                        ✅ EXISTANT
┃  ┃  ┣━ grand_maitre_2.png                        ✅ EXISTANT
┃  ┃  ┣━ grand_maitre_3.png                        ✅ EXISTANT
┃  ┃  ┣━ epique_1.png                              ✅ EXISTANT
┃  ┃  ┣━ epique_2.png)                             ✅ EXISTANT
┃  ┃  ┣━ epique_3.png                              ✅ EXISTANT
┃  ┃  ┣━ epique_4.png                              ✅ EXISTANT
┃  ┃  ┣━ epique_5.png                              ✅ EXISTANT
┃  ┃  ┣━ legende_1.png                             ✅ EXISTANT
┃  ┃  ┣━ legende_2.png                             ✅ EXISTANT
┃  ┃  ┣━ legende_3.png                             ✅ EXISTANT
┃  ┃  ┣━ immortel_1000.png                         ✅ EXISTANT
┃  ┃  ┣━ immortel_100.png                          ✅ EXISTANT
┃  ┃  ┣━ immortel_10.png                           ✅ EXISTANT
┃  ┃  ┗━ immortel_1.png                            ✅ EXISTANT
┃  ┣━ logo/                                        ✅ EXISTANT
┃  ┃  ┣━ icon.png                                  ✅ EXISTANT
┃  ┃  ┣━ icon.webp                                 ✅ EXISTANT
┃  ┃  ┣━ vagondys-mark-icon.png                    ✅ EXISTANT
┃  ┃  ┣━ vagondys-mark-icon.webp                   ✅ EXISTANT
┃  ┃  ┣━ vagondys-mark.png                         ✅ EXISTANT
┃  ┃  ┣━ vagondys-mark.svg                         ✅ EXISTANT
┃  ┃  ┣━ vagondys-mark.webp                        ✅ EXISTANT
┃  ┃  ┣━ vagondys.png                              ✅ EXISTANT
┃  ┃  ┗━ vagondys.webp                             ✅ EXISTANT
┃  ┣━ sounds/                                      ✅ EXISTANT
┃  ┃  ┣━ 3.wav                                     ✅ EXISTANT
┃  ┃  ┣━ 2.wav                                     ✅ EXISTANT
┃  ┃  ┣━ 1.wav                                     ✅ EXISTANT
┃  ┃  ┗━ VIZ.wav                                   ✅ EXISTANT
┃  ┣━ tv/                                          ✅ EXISTANT
┃  ┃  ┣━ 0.html                                    ✅ EXISTANT
┃  ┃  ┣━ 1.html                                    ✅ EXISTANT
┃  ┃  ┣━ 2.html                                    ✅ EXISTANT
┃  ┃  ┣━ 3.html                                    ✅ EXISTANT
┃  ┃  ┣━ 4.html                                    ✅ EXISTANT
┃  ┃  ┣━ 5.html                                    ✅ EXISTANT
┃  ┃  ┣━ 6.html                                    ✅ EXISTANT
┃  ┃  ┣━ 7.html                                    ✅ EXISTANT
┃  ┃  ┗━ 8.html                                    ✅ EXISTANT
┃  ┣━ cible.png                                    ✅ EXISTANT
┃  ┣━ cible.webp                                   ✅ EXISTANT
┃  ┣━ favicon.ico                                  ✅ EXISTANT
┃  ┣━ file.svg                                     ✅ EXISTANT
┃  ┣━ globe.svg                                    ✅ EXISTANT
┃  ┣━ next.svg                                     ✅ EXISTANT
┃  ┣━ tv.html                                      ✅ EXISTANT
┃  ┣━ vagondys-mark.ico                            ✅ EXISTANT
┃  ┣━ vercel.svg                                   ✅ EXISTANT
┃  ┗━ window.svg                                   ✅ EXISTANT
┃
┣━ scripts/                                        ✅ EXISTANT
┃  ┣━ obfuscate-build.js                           ✅ EXISTANT
┃  ┗━ optimize-images.js                           ✅ EXISTANT
┃
┣━ types/                                          ✅ EXISTANT
┃  ┗━ official.types.ts                            ✅ EXISTANT (Centralisation types officiels)
┃
┣━ VAGONDYS_TEST_DATA                              ✅ EXISTANT
┃
┣━ .env.local                                      ✅ EXISTANT
┣━ .gitignore                                      ✅ EXISTANT
┣━ arborescence.txt                                ✅ EXISTANT
┣━ eslint.config.mjs                               ✅ EXISTANT
┣━ generate-test-logs.mjs                          ✅ EXISTANT
┣━ next-env.d.ts                                   ✅ EXISTANT
┣━ next.config.ts                                  ✅ EXISTANT
┣━ package-lock.json                               ✅ EXISTANT
┣━ package.json                                    ✅ EXISTANT
┣━ postcss.config.mjs                              ✅ EXISTANT
┣━ proxy.ts                                        ✅ EXISTANT
┣━ README.md                                       ✅ EXISTANT
┣━ tailwind.config.ts                              ✅ EXISTANT
┣━ tsconfig.json                                   ✅ EXISTANT
┗━ vercel.json                                     ✅ EXISTANT
*/

/*
app/(auth)/espace-joueur/
├── page.tsx (existant)
├── carte-id/
│   └── page.tsx (existant)
└── messagerie/                    (NOUVEAU)
    ├── page.tsx                   (Page principale)
    ├── actions.ts                 (Actions serveur)
    └── components/                (Liens symboliques ou copie)
        ├── MessageList.tsx        (lien vers ../../messagerie/components/MessageList)
        ├── MessageThread.tsx      (lien vers ../../messagerie/components/MessageThread)
        └── MessageInput.tsx       (lien vers ../../messagerie/components/MessageInput)
*/

/*
.vagondys/
└── .github/
    └── workflows/
        ├── recalculate-stats.yml
        └── purge-old-data.yml
*/
