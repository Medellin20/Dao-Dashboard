import type {
  Dao,
  DaoTask,
  DaoStats,
  DaoFilters,
  DaoStatus,
  TaskGlobalProgress,
  TeamMember,
  TaskComment,
} from "@shared/dao";
import {
  calculateDaoStatus,
  calculateDaoProgress,
  DEFAULT_TASKS,
} from "@shared/dao";
import { apiService } from "./api";
import { cacheService } from "./cacheService";

class DaoService {
  // =====================================================
  // CRUD Operations
  // =====================================================

  /**
   * Récupère tous les DAO avec mise en cache
   */
  async getAllDaos(): Promise<Dao[]> {
    return apiService.getAllDaos();
  }

  /**
   * Récupère un DAO par son ID
   */
  async getDaoById(id: string): Promise<Dao> {
    return apiService.getDaoById(id);
  }

  /**
   * Crée un nouveau DAO avec les tâches par défaut
   */
  async createDao(
    daoData: Omit<Dao, "id" | "createdAt" | "updatedAt" | "tasks">,
  ): Promise<Dao> {
    // Ajouter les tâches par défaut
    const daoWithTasks = {
      ...daoData,
      tasks: DEFAULT_TASKS.map((task) => ({
        ...task,
        progress: null,
        assignedTo: undefined,
        lastUpdatedBy: undefined,
        lastUpdatedAt: undefined,
      })),
    };

    return apiService.createDao(daoWithTasks);
  }

  /**
   * Met à jour un DAO complet
   */
  async updateDao(id: string, updates: Partial<Dao>): Promise<Dao> {
    return apiService.updateDao(id, updates);
  }

  /**
   * Supprime un DAO
   */
  async deleteDao(id: string): Promise<void> {
    return apiService.deleteDao(id);
  }

  /**
   * Récupère le prochain numéro de DAO disponible
   */
  async getNextDaoNumber(): Promise<string> {
    return apiService.getNextDaoNumber();
  }

  // =====================================================
  // Task Management
  // =====================================================

  /**
   * Met à jour une tâche spécifique d'un DAO
   */
  async updateTask(
    daoId: string,
    taskId: number,
    updates: Partial<DaoTask>,
  ): Promise<Dao> {
    const dao = await this.getDaoById(daoId);
    const taskIndex = dao.tasks.findIndex((task) => task.id === taskId);

    if (taskIndex === -1) {
      throw new Error(`Tâche avec l'ID ${taskId} non trouvée`);
    }

    // Mettre à jour la tâche
    const updatedTask = {
      ...dao.tasks[taskIndex],
      ...updates,
      lastUpdatedAt: new Date().toISOString(),
    };

    const updatedTasks = [...dao.tasks];
    updatedTasks[taskIndex] = updatedTask;

    // Mettre à jour le DAO avec la nouvelle tâche
    return this.updateDao(daoId, { tasks: updatedTasks });
  }

  /**
   * Met à jour le progrès d'une tâche
   */
  async updateTaskProgress(
    daoId: string,
    taskId: number,
    progress: number,
    userId?: string,
  ): Promise<Dao> {
    return this.updateTask(daoId, taskId, {
      progress: Math.max(0, Math.min(100, progress)), // Clamp entre 0 et 100
      lastUpdatedBy: userId,
    });
  }

  /**
   * Assigne une tâche à un membre d'équipe
   */
  async assignTask(
    daoId: string,
    taskId: number,
    memberId: string,
    userId?: string,
  ): Promise<Dao> {
    return this.updateTask(daoId, taskId, {
      assignedTo: memberId,
      lastUpdatedBy: userId,
    });
  }

  /**
   * Marque/démarque une tâche comme applicable
   */
  async toggleTaskApplicability(
    daoId: string,
    taskId: number,
    isApplicable: boolean,
    userId?: string,
  ): Promise<Dao> {
    return this.updateTask(daoId, taskId, {
      isApplicable,
      lastUpdatedBy: userId,
    });
  }

  // =====================================================
  // Team Management
  // =====================================================

  /**
   * Ajoute un membre à l'équipe du DAO
   */
  async addTeamMember(
    daoId: string,
    member: Omit<TeamMember, "id">,
  ): Promise<Dao> {
    const dao = await this.getDaoById(daoId);
    const newMember: TeamMember = {
      ...member,
      id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    const updatedTeam = [...dao.equipe, newMember];
    return this.updateDao(daoId, { equipe: updatedTeam });
  }

  /**
   * Met à jour un membre de l'équipe
   */
  async updateTeamMember(
    daoId: string,
    memberId: string,
    updates: Partial<Omit<TeamMember, "id">>,
  ): Promise<Dao> {
    const dao = await this.getDaoById(daoId);
    const memberIndex = dao.equipe.findIndex(
      (member) => member.id === memberId,
    );

    if (memberIndex === -1) {
      throw new Error(`Membre avec l'ID ${memberId} non trouvé`);
    }

    const updatedTeam = [...dao.equipe];
    updatedTeam[memberIndex] = { ...updatedTeam[memberIndex], ...updates };

    return this.updateDao(daoId, { equipe: updatedTeam });
  }

  /**
   * Supprime un membre de l'équipe
   */
  async removeTeamMember(daoId: string, memberId: string): Promise<Dao> {
    const dao = await this.getDaoById(daoId);
    const updatedTeam = dao.equipe.filter((member) => member.id !== memberId);

    // Retirer l'assignation des tâches assignées à ce membre
    const updatedTasks = dao.tasks.map((task) => ({
      ...task,
      assignedTo: task.assignedTo === memberId ? undefined : task.assignedTo,
    }));

    return this.updateDao(daoId, {
      equipe: updatedTeam,
      tasks: updatedTasks,
    });
  }

  // =====================================================
  // Statistics & Analytics
  // =====================================================

  /**
   * Calcule les statistiques globales des DAO
   */
  async getDaoStats(): Promise<DaoStats> {
    const cacheKey = "dao-stats";
    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const daos = await this.getAllDaos();
        const now = new Date();

        let daoEnCours = 0;
        let daoTermines = 0;
        let daoArisque = 0;
        let totalProgress = 0;

        for (const dao of daos) {
          const progress = calculateDaoProgress(dao.tasks);
          const status = calculateDaoStatus(dao.dateDepot, progress);

          totalProgress += progress;

          switch (status) {
            case "completed":
              daoTermines++;
              break;
            case "urgent":
              daoArisque++;
              daoEnCours++;
              break;
            case "safe":
            case "default":
              daoEnCours++;
              break;
          }
        }

        return {
          totalDaos: daos.length,
          daoEnCours,
          daoTermines,
          daoArisque,
          progressionGlobale:
            daos.length > 0 ? Math.round(totalProgress / daos.length) : 0,
        };
      },
      60 * 1000, // Cache 1 minute
    );
  }

  /**
   * Calcule le progrès global par tâche
   */
  async getTaskGlobalProgress(): Promise<TaskGlobalProgress[]> {
    const cacheKey = "task-global-progress";
    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const daos = await this.getAllDaos();
        const taskProgressMap = new Map<
          number,
          { totalProgress: number; count: number; name: string }
        >();

        // Aggreger les progrès par tâche
        for (const dao of daos) {
          for (const task of dao.tasks) {
            if (!task.isApplicable || task.progress === null) continue;

            const existing = taskProgressMap.get(task.id) || {
              totalProgress: 0,
              count: 0,
              name: task.name,
            };

            existing.totalProgress += task.progress;
            existing.count += 1;
            taskProgressMap.set(task.id, existing);
          }
        }

        // Calculer les moyennes
        return Array.from(taskProgressMap.entries())
          .map(([taskId, data]) => ({
            taskId,
            taskName: data.name,
            globalProgress: Math.round(data.totalProgress / data.count),
            applicableDaosCount: data.count,
          }))
          .sort((a, b) => a.taskId - b.taskId);
      },
      2 * 60 * 1000, // Cache 2 minutes
    );
  }

  // =====================================================
  // Filtering & Search
  // =====================================================

  /**
   * Filtre les DAO selon les critères spécifiés
   */
  async getFilteredDaos(filters: DaoFilters): Promise<Dao[]> {
    const allDaos = await this.getAllDaos();

    return allDaos.filter((dao) => {
      // Filtre par date
      if (filters.dateRange) {
        const daoDate = new Date(dao.dateDepot);
        const startDate = new Date(filters.dateRange.start);
        const endDate = new Date(filters.dateRange.end);

        if (daoDate < startDate || daoDate > endDate) {
          return false;
        }
      }

      // Filtre par autorité contractante
      if (filters.autoriteContractante) {
        if (
          !dao.autoriteContractante
            .toLowerCase()
            .includes(filters.autoriteContractante.toLowerCase())
        ) {
          return false;
        }
      }

      // Filtre par statut
      if (filters.statut) {
        const progress = calculateDaoProgress(dao.tasks);
        const status = calculateDaoStatus(dao.dateDepot, progress);

        switch (filters.statut) {
          case "en_cours":
            if (status === "completed") return false;
            break;
          case "termine":
            if (status !== "completed") return false;
            break;
          case "a_risque":
            if (status !== "urgent") return false;
            break;
        }
      }

      // Filtre par équipe
      if (filters.equipe) {
        const hasTeamMember = dao.equipe.some((member) =>
          member.name.toLowerCase().includes(filters.equipe!.toLowerCase()),
        );
        if (!hasTeamMember) return false;
      }

      return true;
    });
  }

  /**
   * Recherche de DAO par mots-clés
   */
  async searchDaos(query: string): Promise<Dao[]> {
    const allDaos = await this.getAllDaos();
    const searchTerm = query.toLowerCase().trim();

    if (!searchTerm) return allDaos;

    return allDaos.filter((dao) => {
      return (
        dao.numeroListe.toLowerCase().includes(searchTerm) ||
        dao.objetDossier.toLowerCase().includes(searchTerm) ||
        dao.reference.toLowerCase().includes(searchTerm) ||
        dao.autoriteContractante.toLowerCase().includes(searchTerm) ||
        dao.equipe.some((member) =>
          member.name.toLowerCase().includes(searchTerm),
        )
      );
    });
  }

  // =====================================================
  // Utility Methods
  // =====================================================

  /**
   * Calcule le statut d'un DAO
   */
  getDaoStatus(dao: Dao): DaoStatus {
    const progress = calculateDaoProgress(dao.tasks);
    return calculateDaoStatus(dao.dateDepot, progress);
  }

  /**
   * Calcule le progrès d'un DAO
   */
  getDaoProgress(dao: Dao): number {
    return calculateDaoProgress(dao.tasks);
  }

  /**
   * Obtient les tâches assignées à un membre spécifique
   */
  getTasksAssignedTo(dao: Dao, memberId: string): DaoTask[] {
    return dao.tasks.filter((task) => task.assignedTo === memberId);
  }

  /**
   * Obtient le nombre de jours restants avant la date de dépôt
   */
  getDaysUntilDeadline(dao: Dao): number {
    const today = new Date();
    const deadlineDate = new Date(dao.dateDepot);
    return Math.ceil(
      (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  /**
   * Vérifie si un DAO est en retard
   */
  isDaoOverdue(dao: Dao): boolean {
    return this.getDaysUntilDeadline(dao) < 0;
  }

  /**
   * Obtient les tâches non applicables d'un DAO
   */
  getNonApplicableTasks(dao: Dao): DaoTask[] {
    return dao.tasks.filter((task) => !task.isApplicable);
  }

  /**
   * Obtient les tâches en cours (applicables avec progrès < 100%)
   */
  getInProgressTasks(dao: Dao): DaoTask[] {
    return dao.tasks.filter(
      (task) => task.isApplicable && (task.progress || 0) < 100,
    );
  }

  /**
   * Obtient les tâches terminées
   */
  getCompletedTasks(dao: Dao): DaoTask[] {
    return dao.tasks.filter(
      (task) => task.isApplicable && task.progress === 100,
    );
  }

  /**
   * Calcule la répartition des tâches par membre d'équipe
   */
  getTaskDistribution(
    dao: Dao,
  ): Record<string, { member: TeamMember; taskCount: number }> {
    const distribution: Record<
      string,
      { member: TeamMember; taskCount: number }
    > = {};

    // Initialiser avec tous les membres d'équipe
    dao.equipe.forEach((member) => {
      distribution[member.id] = { member, taskCount: 0 };
    });

    // Compter les tâches assignées
    dao.tasks.forEach((task) => {
      if (task.assignedTo && distribution[task.assignedTo]) {
        distribution[task.assignedTo].taskCount++;
      }
    });

    return distribution;
  }

  /**
   * Invalide tout le cache lié aux DAO
   */
  invalidateCache(): void {
    cacheService.delete("all-daos");
    cacheService.delete("dao-stats");
    cacheService.delete("task-global-progress");

    // Invalider aussi les caches individuels des DAO
    cacheService.deletePattern("dao-");
  }

  /**
   * Exporte les données d'un DAO au format JSON
   */
  exportDaoToJson(dao: Dao): string {
    return JSON.stringify(dao, null, 2);
  }

  /**
   * Clone un DAO (créer une copie)
   */
  async cloneDao(
    daoId: string,
    newData: Partial<
      Pick<
        Dao,
        | "numeroListe"
        | "objetDossier"
        | "reference"
        | "autoriteContractante"
        | "dateDepot"
      >
    >,
  ): Promise<Dao> {
    const originalDao = await this.getDaoById(daoId);

    const clonedDao = {
      numeroListe: newData.numeroListe || `${originalDao.numeroListe}_COPIE`,
      objetDossier:
        newData.objetDossier || `${originalDao.objetDossier} (Copie)`,
      reference: newData.reference || `${originalDao.reference}_COPIE`,
      autoriteContractante:
        newData.autoriteContractante || originalDao.autoriteContractante,
      dateDepot: newData.dateDepot || originalDao.dateDepot,
      equipe: [...originalDao.equipe], // Copie de l'équipe
    };

    return this.createDao(clonedDao);
  }
}

export const daoService = new DaoService();
